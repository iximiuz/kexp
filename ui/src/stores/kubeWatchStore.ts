import { useStorage, type RemovableRef } from "@vueuse/core";
import { defineStore, acceptHMRUpdate } from "pinia";

import { isApplicationKindOfResource } from "../common/relations";
import type {
  KubeContext,
  KubeObject,
  KubeObjectDescriptor,
  KubeObjectMap,
  KubeResource,
  KubeSelector,
} from "../common/types";
import { RelatedWatcher, ResourceWatcher } from "../common/watchers";

import { useKubeGraphStore } from "./kubeGraphStore";

export const WATCH_KIND_OBJECT = "object";
export const WATCH_KIND_RESOURCE = "resource";
export const WATCH_KIND_RELATED = "related";
export const WATCH_KIND_RELATED_OBJECT = "related-object";
export const WATCH_KIND_RELATED_RESOURCE = "related-resource";

export const WATCH_PRESET_APPLICATION = "application";

interface BaseWatch {
  id: string;
  bindingId: string;
  createdAt: number;
  context: string;
}

interface ObjectWatch extends BaseWatch {
  kind: typeof WATCH_KIND_OBJECT;
  object: KubeObjectDescriptor,
}

interface ResourceWatch extends BaseWatch {
  kind: typeof WATCH_KIND_RESOURCE;
  resource: KubeResource;
  selector?: KubeSelector;
}

interface RelatedWatch extends BaseWatch {
  kind: typeof WATCH_KIND_RELATED;
  target: KubeObjectDescriptor;
  preset?: string;
}

interface RelatedObjectWatch extends BaseWatch {
  kind: typeof WATCH_KIND_RELATED_OBJECT;
  target: KubeObjectDescriptor;
  object: KubeObjectDescriptor;
}

interface RelatedResourceWatch extends BaseWatch {
  kind: typeof WATCH_KIND_RELATED_RESOURCE;
  target: KubeObjectDescriptor;
  resource: KubeResource;
}

export type Watch = ObjectWatch | ResourceWatch | RelatedWatch | RelatedObjectWatch | RelatedResourceWatch;

class WatchBinding {
  _id: string;
  _ctx: KubeContext;
  _watcher: RelatedWatcher | ResourceWatcher;
  _watches: Record<string, Watch>;

  constructor(
    id: string,
    ctx: KubeContext,
    watcher: RelatedWatcher | ResourceWatcher,
  ) {
    this._id = id;
    this._ctx = ctx;

    this._watcher = watcher;
    this._watcher.addEventListener(() => this.onWatchEvent());

    this._watches = {};
  }

  destroy() {
    this._watcher.destroy();
    useKubeGraphStore().removeAllObjects("watch-binding-" + this._id);
  }

  addWatch(watch: Watch) {
    this._watches[watch.id] = watch;
  }

  removeWatch(watch: Watch) {
    delete this._watches[watch.id];
  }

  isEmpty() {
    return Object.keys(this._watches).length === 0;
  }

  async warmUp() {
    await this._watcher.watch();
  }

  objects(watchId?: string): KubeObject[] {
    const objs: KubeObjectMap = {};
    for (const obj of this._watcher.objects()) {
      for (const watch of Object.values(this._watches)) {
        if (watchId && watch.id !== watchId) {
          continue;
        }

        if (_watchMatch(watch, obj)) {
          objs[obj.ident] = obj;
        }
      }
    }
    return Object.values(objs);
  }

  onWatchEvent() {
    useKubeGraphStore().removeAllObjects("watch-binding-" + this._id);

    for (const obj of this.objects()) {
      useKubeGraphStore().upsertObject("watch-binding-" + this._id, obj);
    }
  }
}

interface KubeWatchStoreState {
  _bindings: Record<string, WatchBinding>;

  _persistent: RemovableRef<{
    watches: Record<string, Watch>;
  }>;
}

export const useKubeWatchStore = defineStore({
  id: "kubeWatchStore",

  state: (): KubeWatchStoreState => ({
    _bindings: {},

    _persistent: useStorage(
      "kubeWatchStore",
      {
        watches: {}, // by cluster name, then by a watch id
      },
      localStorage,
      { mergeDefaults: true },
    ),
  }),

  getters: {
    isEmpty: (state) => {
      return Object.keys(state._persistent.watches).length === 0;
    },

    watches: (state) => {
      return (): Watch[] => {
        return Object.values(state._persistent.watches).sort((a, b) => b.createdAt - a.createdAt);
      };
    },

    contexts: (state) => {
      return (): string[] => {
        const contexts: Record<string, boolean> = {};
        Object.values(state._persistent.watches).forEach((w) => { contexts[w.context] = true; });
        return Object.keys(contexts);
      };
    },

    objects: (state) => {
      return (ctx: KubeContext, res: KubeResource): KubeObject[] => {
        const objs: KubeObjectMap = {};

        Object.values(state._bindings).filter((b) => b._ctx.name === ctx.name).forEach((b) => {
          for (const obj of b.objects()) {
            if (obj.resource.groupVersion === res.groupVersion && obj.resource.kind === res.kind) {
              objs[obj.ident] = obj;
            }
          }
        });

        return Object.values(objs);
      };
    },
  },

  actions: {
    async load(contexts: KubeContext[]) {
      const storedWatches = this._persistent.watches;

      this._persistent.watches = {};
      for (const watch of Object.values(storedWatches).sort((a, b) => a.createdAt - b.createdAt)) {
        const ctx = contexts.find((c) => c.name === watch.context);
        if (!ctx) {
          console.warn("kubeWatchStore: context not found", watch);
          continue;
        }

        switch (watch.kind) {
        case WATCH_KIND_OBJECT:
          await this.addObjectWatch(ctx, watch.object);
          break;

        case WATCH_KIND_RESOURCE:
          await this.addResourceWatch(ctx, watch.resource, watch.selector);
          break;

        case WATCH_KIND_RELATED:
          await this.addRelatedWatch(ctx, watch.target, watch.preset);
          break;

        case WATCH_KIND_RELATED_OBJECT:
          await this.addRelatedObjectWatch(ctx, watch.target, watch.object);
          break;

        case WATCH_KIND_RELATED_RESOURCE:
          await this.addRelatedResourceWatch(ctx, watch.target, watch.resource);
          break;
        }
      }
    },

    async addObjectWatch(ctx: KubeContext, obj: KubeObjectDescriptor) {
      const watch = _objectWatch(ctx, obj);

      await this._addWatch(ctx, watch, () => new ResourceWatcher(ctx, obj.resource, {
        name: obj.name,
        namespace: obj.namespace,
      }));
    },

    getObjectWatch(ctx: KubeContext, obj: KubeObjectDescriptor): ObjectWatch | undefined {
      return this._persistent.watches[_objectWatchId(ctx, obj)] as ObjectWatch;
    },

    async addResourceWatch(ctx: KubeContext, res: KubeResource, selector?: KubeSelector) {
      const watch = _resourceWatch(ctx, res, selector);

      await this._addWatch(ctx, watch, () => new ResourceWatcher(ctx, res, selector));
    },

    getResourceWatch(ctx: KubeContext, res: KubeResource): ResourceWatch | undefined {
      return this._persistent.watches[_resourceWatchId(ctx, res)] as ResourceWatch;
    },

    async addRelatedWatch(
      ctx: KubeContext,
      target: KubeObjectDescriptor,
      preset?: string,
    ) {
      const watch = _relatedWatch(ctx, target, preset);

      await this._addWatch(ctx, watch, () => new RelatedWatcher(ctx, target));
    },

    getRelatedWatch(
      ctx: KubeContext,
      target: KubeObjectDescriptor,
      preset?: string,
    ): RelatedWatch | undefined {
      return this._persistent.watches[_relatedWatchId(ctx, target, preset)] as RelatedWatch;
    },

    async addRelatedObjectWatch(
      ctx: KubeContext,
      target: KubeObjectDescriptor,
      obj: KubeObjectDescriptor,
    ) {
      const watch = _relatedObjectWatch(ctx, target, obj);

      await this._addWatch(ctx, watch, () => new RelatedWatcher(ctx, target));
    },

    getRelatedObjectWatch(
      ctx: KubeContext,
      target: KubeObjectDescriptor,
      obj: KubeObjectDescriptor,
    ): RelatedObjectWatch | undefined {
      return this._persistent.watches[_relatedObjectWatchId(ctx, target, obj)] as RelatedObjectWatch;
    },

    async addRelatedResourceWatch(
      ctx: KubeContext,
      target: KubeObjectDescriptor,
      res: KubeResource,
    ) {
      const watch = _relatedResourceWatch(ctx, target, res);

      await this._addWatch(ctx, watch, () => new RelatedWatcher(ctx, target));
    },

    getRelatedResourceWatch(
      ctx: KubeContext,
      target: KubeObjectDescriptor,
      res: KubeResource,
    ): RelatedResourceWatch | undefined {
      return this._persistent.watches[_relatedResourceWatchId(ctx, target, res)] as RelatedResourceWatch;
    },

    removeWatch(watch: Watch) {
      const binding = this._bindings[watch.bindingId];
      if (!binding) {
        console.warn("kubeWatchStore: watch binding not found", binding);
      } else {
        binding.removeWatch(watch);
        if (binding.isEmpty()) {
          binding.destroy();
          delete this._bindings[watch.bindingId];
        } else {
          this._bindings[watch.bindingId].onWatchEvent();
        }
      }

      if (!this._persistent.watches[watch.id]) {
        console.warn("kubeWatchStore: watch not found", watch);
      } else {
        delete this._persistent.watches[watch.id];
      }
    },

    highlightWatch(watch: Watch) {
      const binding = this._bindings[watch.bindingId];
      if (!binding) {
        console.warn("kubeWatchStore: watch binding not found", watch);
        return;
      }

      useKubeGraphStore().highlightObjects(binding.objects(watch.id));
    },

    unhighlightWatch() {
      useKubeGraphStore().highlightObjects([]);
    },

    async _addWatch(ctx: KubeContext, watch: Watch, onNewWatcher: () => RelatedWatcher | ResourceWatcher) {
      if (this._persistent.watches[watch.id]) {
        console.warn("kubeWatchStore: watch already exists for %j", watch);
        return;
      }

      this._persistent.watches[watch.id] = watch;

      if (!this._bindings[watch.bindingId]) {
        this._bindings[watch.bindingId] = new WatchBinding(watch.bindingId, ctx, onNewWatcher());
        await this._bindings[watch.bindingId].warmUp();
      }

      this._bindings[watch.bindingId].addWatch(watch);
      this._bindings[watch.bindingId].onWatchEvent();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useKubeWatchStore, import.meta.hot));
}

function _objectWatchId(ctx: KubeContext, obj: KubeObjectDescriptor): string {
  return `${ctx.name}/${obj.ident}`;
}

function _objectWatch(ctx: KubeContext, obj: KubeObjectDescriptor): ObjectWatch {
  return {
    kind: WATCH_KIND_OBJECT,
    id: _objectWatchId(ctx, obj),
    bindingId: _objectWatchId(ctx, obj), // one-to-one relation
    createdAt: Date.now(),
    context: ctx.name,
    object: obj,
  };
}

function _resourceWatchId(ctx: KubeContext, res: KubeResource): string {
  return `${ctx.name}/${res.groupVersion}/${res.kind}`;
}

function _resourceWatch(ctx: KubeContext, res: KubeResource, selector?: KubeSelector): ResourceWatch {
  return {
    kind: WATCH_KIND_RESOURCE,
    id: _resourceWatchId(ctx, res),
    bindingId: _resourceWatchId(ctx, res), // one-to-one relation
    createdAt: Date.now(),
    context: ctx.name,
    resource: res,
    selector,
  };
}

function _relatedWatchId(ctx: KubeContext, target: KubeObjectDescriptor, preset?: string): string {
  return `${ctx.name}/${target.ident}/related${preset ? `/${preset}` : ""}`;
}

function _relatedWatch(ctx: KubeContext, target: KubeObjectDescriptor, preset?: string): RelatedWatch {
  return {
    kind: WATCH_KIND_RELATED,
    id: _relatedWatchId(ctx, target, preset),
    bindingId: `${ctx.name}/${target.ident}/related`, // one-to-many relation
    createdAt: Date.now(),
    context: ctx.name,
    target,
    preset,
  };
}

function _relatedObjectWatchId(ctx: KubeContext, target: KubeObjectDescriptor, obj: KubeObjectDescriptor): string {
  return `${ctx.name}/${target.ident}/related-object/${obj.ident}`;
}

function _relatedObjectWatch(ctx: KubeContext, target: KubeObjectDescriptor, obj: KubeObjectDescriptor): RelatedObjectWatch {
  return {
    kind: WATCH_KIND_RELATED_OBJECT,
    id: _relatedObjectWatchId(ctx, target, obj),
    bindingId: `${ctx.name}/${target.ident}/related`, // one-to-many relation
    createdAt: Date.now(),
    context: ctx.name,
    target,
    object: obj,
  };
}

function _relatedResourceWatchId(ctx: KubeContext, target: KubeObjectDescriptor, res: KubeResource): string {
  return `${ctx.name}/${target.ident}/related-resource/${res.groupVersion}/${res.kind}`;
}

function _relatedResourceWatch(ctx: KubeContext, target: KubeObjectDescriptor, res: KubeResource): RelatedResourceWatch {
  return {
    kind: WATCH_KIND_RELATED_RESOURCE,
    id: _relatedResourceWatchId(ctx, target, res),
    bindingId: `${ctx.name}/${target.ident}/related`, // one-to-many relation
    createdAt: Date.now(),
    context: ctx.name,
    target,
    resource: res,
  };
}

function _watchMatch(watch: Watch, obj: KubeObject): boolean {
  if (watch.kind === WATCH_KIND_OBJECT) {
    return true; // Based on the watcher selector logic
  }

  if (watch.kind === WATCH_KIND_RESOURCE) {
    return true; // Based on the watcher selector logic
  }

  if (watch.kind === WATCH_KIND_RELATED) {
    if (watch.preset === WATCH_PRESET_APPLICATION) {
      return isApplicationKindOfResource(obj.gvk.toString());
    }

    return true;
  }

  if (watch.kind === WATCH_KIND_RELATED_OBJECT) {
    return obj.isSame(watch.object);
  }

  if (watch.kind === WATCH_KIND_RELATED_RESOURCE) {
    return obj.resource.groupVersion === watch.resource.groupVersion && obj.resource.kind === watch.resource.kind;
  }

  return false;
}
