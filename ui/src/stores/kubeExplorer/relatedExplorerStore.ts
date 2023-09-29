import { defineStore, acceptHMRUpdate } from "pinia";

import type {
  KubeContext,
  KubeObject,
  KubeResource,
  KubeResourceGroup,
} from "../../common/types";
import { RelatedWatcher } from "../../common/watchers";

import { useKubeDataStore } from "../kubeDataStore";
import { useKubeWatchStore } from "../kubeWatchStore";

import { filterObjects, filterResources, filterResourceGroups, isApplicableObjectFilterExpr } from "./filter";

interface TreeNode {
  open?: boolean;
}

interface Tree {
  open: boolean;
  contexts: Record<string, TreeNode>;
  resourceGroups: Record<string, TreeNode>;
  resources: Record<string, TreeNode>;
}

export const useRelatedExplorerStore = defineStore({
  id: "relatedExplorerStore",

  state: () => ({
    _target: null as KubeObject | null,

    _watchers: {} as Record<string, RelatedWatcher>,

    _focused: null as KubeObject | null,

    tree: {
      open: false,
      contexts: {},
      resourceGroups: {},
      resources: {},
    } as Tree,

    filterExpr: null as string | null,
  }),

  getters: {
    target(state): KubeObject | null {
      return state._target;
    },

    contexts(): () => KubeContext[] {
      return () => useKubeDataStore().contexts()
        .filter((ctx) => this.target && ctx.clusterUID === this.target.clusterUID)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    resourceGroups(): (ctx: KubeContext) => KubeResourceGroup[] {
      return (ctx) => {
        if (!this.target) {
          return [];
        }

        return filterResourceGroups(useKubeDataStore().resourceGroups(ctx), this.filterExpr)
          .filter((group) => (group.resources || []).some((res) => this.objects(ctx, res).length > 0))
          .sort((a, b) => a.groupVersion.localeCompare(b.groupVersion));
      };
    },

    resources(): (ctx: KubeContext, group: KubeResourceGroup) => KubeResource[] {
      return (ctx, group) => {
        if (!this.target) {
          return [];
        }

        return filterResources(group.resources || [], this.filterExpr)
          .filter((res) => this.objects(ctx, res).length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    },

    objects(): (ctx: KubeContext, res: KubeResource) => KubeObject[] {
      return (ctx: KubeContext, res: KubeResource): KubeObject[] => {
        if (!this.target) {
          return [];
        }

        const w = this._watcher(ctx);
        if (!w) {
          return [];
        }

        return filterObjects(w.objects(), this.filterExpr)
          .filter((obj) => obj.resource.groupVersion === res.groupVersion && obj.resource.kind === res.kind)
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    },

    focused: (state): KubeObject | null => {
      return state._focused;
    },

    isTreeOpen: (state): boolean => {
      return !!state.tree.open;
    },

    isContextOpen(): (ctx: KubeContext) => boolean {
      return (ctx: KubeContext): boolean => !!_getOrCreateContextNode(this.tree, ctx.name).open;
    },

    isResourceGroupOpen(): (ctx: KubeContext, group: KubeResourceGroup) => boolean {
      return (ctx: KubeContext, group: KubeResourceGroup): boolean => !!this.filterExpr ||
        !!_getOrCreateResourceGroupNode(this.tree, ctx.name, group.groupVersion).open;
    },

    isResourceOpen(state): (ctx: KubeContext, res: KubeResource) => boolean {
      return (ctx, res) => (!!this.filterExpr && isApplicableObjectFilterExpr(res, this.filterExpr)) ||
        !!_getOrCreateResourceNode(state.tree, ctx.name, res.groupVersion, res.kind).open;
    },

    _watcher(state): (ctx: KubeContext) => RelatedWatcher | undefined {
      return (ctx) => state._watchers[ctx.name];
    },
  },

  actions: {
    async loadContexts() {
      await useKubeDataStore().fetchContexts();
    },

    async loadResources(ctx: KubeContext) {
      await useKubeDataStore().fetchResources(ctx);

      this._ensureWatcher(ctx);
      await this._watcher(ctx)!.watch();
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async loadObjects(ctx: KubeContext, res: KubeResource) {
      // no-op, everything should be loaded by loadResources already.
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async releaseObjects(ctx: KubeContext, res: KubeResource) {
      // no-op, a global per-store cleanup is only possible.
    },

    openTree() {
      this.tree.open = true;
    },

    toggleTree() {
      this.tree.open = !this.tree.open;
      if (!this.tree.open) {
        this._reset();
      }
    },

    toggleContext(ctx: KubeContext) {
      const view = _getOrCreateContextNode(this.tree, ctx.name);
      view.open = !view.open;
    },

    toggleResourceGroup(ctx: KubeContext, group: KubeResourceGroup) {
      const view = _getOrCreateResourceGroupNode(this.tree, ctx.name, group.groupVersion);
      view.open = !view.open;
    },

    toggleResource(ctx: KubeContext, res: KubeResource) {
      const view = _getOrCreateResourceNode(this.tree, ctx.name, res.groupVersion, res.kind);
      view.open = !view.open;
    },

    setTargetObject(ko: KubeObject | null) {
      this._reset();
      this._target = ko;
    },

    async setFocusedObject(ko: KubeObject) {
      if (this._focused) {
        if (ko && ko.ident === this._focused.ident) {
          return;
        }

        this._resetFocusedObject();
      }

      if (ko) {
        this._focused = ko;
        this._focused.focused = true;
      }
    },

    async watchObject(ctx: KubeContext, ko: KubeObject) {
      if (!this.target) {
        throw new Error("Cannot watch object without a target");
      }

      await useKubeWatchStore().addRelatedObjectWatch(ctx, this.target.descriptor, ko.descriptor);
    },

    async unwatchObject(ctx: KubeContext, ko: KubeObject) {
      if (!this.target) {
        throw new Error("Cannot unwatch object without a target");
      }

      const w = useKubeWatchStore().getRelatedObjectWatch(ctx, this.target.descriptor, ko.descriptor);
      if (w) {
        useKubeWatchStore().removeWatch(w);
      }
    },

    isObjectWatched(ctx: KubeContext, ko: KubeObject) {
      return !!(this.target && useKubeWatchStore().getRelatedObjectWatch(ctx, this.target.descriptor, ko.descriptor));
    },

    async watchResource(ctx: KubeContext, res: KubeResource) {
      if (!this.target) {
        throw new Error("Cannot watch resource without a target");
      }

      await useKubeWatchStore().addRelatedResourceWatch(ctx, this.target.descriptor, res);
    },

    async unwatchResource(ctx: KubeContext, res: KubeResource) {
      if (!this.target) {
        throw new Error("Cannot unwatch resource without a target");
      }

      const w = useKubeWatchStore().getRelatedResourceWatch(ctx, this.target.descriptor, res);
      if (w) {
        useKubeWatchStore().removeWatch(w);
      }
    },

    isResourceWatched(ctx: KubeContext, res: KubeResource) {
      return !!this.target && !!useKubeWatchStore().getRelatedResourceWatch(ctx, this.target.descriptor, res);
    },

    setFilterExpr(f: string) {
      this.filterExpr = f.trim();
    },

    clearFilterExpr() {
      this.filterExpr = null;
    },

    _ensureWatcher(ctx: KubeContext) {
      if (!this.target) {
        throw new Error("Cannot create watcher without a target");
      }

      if (!this._watchers[ctx.name]) {
        this._watchers[ctx.name] = new RelatedWatcher(ctx, this.target.descriptor);
      }
    },

    _reset() {
      this._resetFocusedObject();

      Object.values(this._watchers).forEach((w) => {
        w.destroy();
      });

      this._watchers = {};
    },

    _resetFocusedObject() {
      if (this._focused) {
        delete this._focused.focused;
        this._focused = null;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRelatedExplorerStore, import.meta.hot));
}

function _getOrCreateContextNode(tree: Tree, name: string): TreeNode {
  tree.contexts[name] = tree.contexts[name] || {
    open: true,
  };
  return tree.contexts[name];
}

function _getOrCreateResourceGroupNode(tree: Tree, ctxName: string, groupVersion: string): TreeNode {
  const key = `${ctxName}/${groupVersion}`;
  tree.resourceGroups[key] = tree.resourceGroups[key] || {
    open: true,
  };
  return tree.resourceGroups[key];
}

function _getOrCreateResourceNode(tree: Tree, ctxName: string, groupVersion: string, kind: string): TreeNode {
  const key = `${ctxName}/${groupVersion}/${kind}`;
  tree.resources[key] = tree.resources[key] || {
    open: true,
  };
  return tree.resources[key];
}
