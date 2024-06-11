import { useStorage } from "@vueuse/core";
import { defineStore, acceptHMRUpdate } from "pinia";

import type {
  KubeContext,
  KubeObject,
  KubeResource,
  KubeResourceGroup,
  KubeSelector,
} from "../../common/types";
import { ResourceWatcher } from "../../common/watchers";

import { useKubeDataStore } from "../kubeDataStore";
import { useKubeWatchStore } from "../kubeWatchStore";

import {
  type Filter,
  filterObjects,
  filterResources,
  filterResourceGroups,
  isApplicableObjectFilterExpr,
  parseFilterExpr,
} from "./filter";
import { useRelatedExplorerStore } from "./relatedExplorerStore";

interface TreeNode {
  open?: boolean;
}

interface Tree {
  open: boolean;
  contexts: Record<string, TreeNode>;
  resourceGroups: Record<string, TreeNode>;
  resources: Record<string, TreeNode>;
}

export const useAllExplorerStore = defineStore({
  id: "allExplorerStore",

  state: () => ({
    _watchers: {} as Record<string, Record<string, ResourceWatcher>>,

    _focused: null as KubeObject | null,

    _persistent: useStorage(
      "allExplorerStore",
      {
        tree: {
          open: false,
          contexts: {},
          resourceGroups: {},
          resources: {},
        } as Tree,
        selectors: {} as Record<string, Record<string, KubeSelector>>, // { clusterName => { resource { selector }}
        filterExpr: null as string | null,
        filters: [] as Filter[],
      },
      localStorage,
      { mergeDefaults: true },
    ),
  }),

  getters: {
    contexts(): () => KubeContext[] {
      return () => useKubeDataStore().contexts()
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    resourceGroups(): (ctx: KubeContext) => KubeResourceGroup[] {
      return (ctx) => {
        return filterResourceGroups(useKubeDataStore().resourceGroups(ctx), this._persistent.filters)
          .sort((a, b) => a.groupVersion.localeCompare(b.groupVersion));
      };
    },

    resources(): (ctx: KubeContext, group: KubeResourceGroup) => KubeResource[] {
      return (ctx, group) => {
        return filterResources(group.resources || [], this._persistent.filters)
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    },

    objects(): (ctx: KubeContext, res: KubeResource) => KubeObject[] {
      return (ctx, res) => {
        const w = this._watcher(ctx, res);
        return w
          ? filterObjects(w.objects(), this._persistent.filters).sort((a, b) => a.name.localeCompare(b.name))
          : [];
      };
    },

    focused(state): KubeObject | null {
      return state._focused;
    },

    selector(state): ((ctx: KubeContext, res: KubeResource) => KubeSelector) {
      return (ctx, res) => {
        return (state._persistent.selectors[ctx.name] || {})[res.groupVersion + "/" + res.kind] || {};
      };
    },

    isTreeOpen(state): boolean {
      return state._persistent.tree.open;
    },

    isContextOpen(state): (ctx: KubeContext) => boolean {
      return (ctx: KubeContext) => {
        const node = _getOrCreateContextNode(state._persistent.tree, ctx.name);
        if (node.open === undefined) {
          node.open = this.contexts().length === 1;
        }
        return node.open;
      };
    },

    isResourceGroupOpen(state): (ctx: KubeContext, group: KubeResourceGroup) => boolean {
      return (ctx, group) => !!this.filterExpr ||
        !!_getOrCreateResourceGroupNode(state._persistent.tree, ctx.name, group.groupVersion).open;
    },

    isResourceOpen(state): (ctx: KubeContext, res: KubeResource) => boolean {
      return (ctx, res) => isApplicableObjectFilterExpr(res, this.filterExpr, this._persistent.filters) ||
        !!_getOrCreateResourceNode(state._persistent.tree, ctx.name, res.groupVersion, res.kind).open;
    },

    hasFilterExpr(state): boolean {
      return !!state._persistent.filterExpr;
    },

    filterExpr(state): string | null {
      return state._persistent.filterExpr;
    },

    _watcher(state): (ctx: KubeContext, res: KubeResource) => ResourceWatcher | undefined {
      return (ctx, res) => state._watchers[ctx.name] && state._watchers[ctx.name][res.groupVersion + "/" + res.kind];
    },
  },

  actions: {
    async loadContexts(): Promise<void> {
      await useKubeDataStore().fetchContexts();
    },

    async loadResources(ctx: KubeContext): Promise<void> {
      await useKubeDataStore().fetchResources(ctx);
    },

    async loadObjects(ctx: KubeContext, res: KubeResource): Promise<void> {
      await this.releaseObjects(ctx, res);

      this._initWatcher(ctx, res);
      await this._watcher(ctx, res)?.watch();
    },

    async releaseObjects(ctx: KubeContext, res: KubeResource): Promise<void> {
      const w = this._watcher(ctx, res);
      if (w) {
        w.destroy();
        delete this._watchers[ctx.name][res.groupVersion + "/" + res.kind];
      }
    },

    async setFocusedObject(ko: KubeObject | null) {
      if (this._focused) {
        if (ko && ko.ident === this._focused.ident) {
          return;
        }

        delete this._focused.focused;
        this._focused = null;
      }

      useRelatedExplorerStore().setTargetObject(ko);

      if (ko) {
        this._focused = ko;
        this._focused.focused = true;
      }
    },

    async setResourceSelector(ctx: KubeContext, res: KubeResource, selector: KubeSelector) {
      const watched = this.isResourceWatched(ctx, res);
      if (watched) {
        await this.unwatchResource(ctx, res);
      }

      this._persistent.selectors[ctx.name] = this._persistent.selectors[ctx.name] || {};
      this._persistent.selectors[ctx.name][res.groupVersion + "/" + res.kind] = selector;

      await this.loadObjects(ctx, res);

      if (watched) {
        await this.watchResource(ctx, res);
      }
    },

    async watchObject(ctx: KubeContext, ko: KubeObject) {
      await useKubeWatchStore().addObjectWatch(ctx, ko.descriptor);
    },

    async unwatchObject(ctx: KubeContext, ko: KubeObject) {
      const w = useKubeWatchStore().getObjectWatch(ctx, ko.descriptor);
      if (w) {
        useKubeWatchStore().removeWatch(w);
      }
    },

    isObjectWatched(ctx: KubeContext, ko: KubeObject) {
      return !!useKubeWatchStore().getObjectWatch(ctx, ko.descriptor);
    },

    async watchResource(ctx: KubeContext, res: KubeResource) {
      await useKubeWatchStore().addResourceWatch(ctx, res, this.selector(ctx, res));
    },

    async unwatchResource(ctx: KubeContext, res: KubeResource) {
      const w = useKubeWatchStore().getResourceWatch(ctx, res);
      if (w) {
        useKubeWatchStore().removeWatch(w);
      }
    },

    isResourceWatched(ctx: KubeContext, res: KubeResource) {
      return !!useKubeWatchStore().getResourceWatch(ctx, res);
    },

    openTree() {
      this._persistent.tree.open = true;
    },

    toggleTree() {
      this._persistent.tree.open = !this._persistent.tree.open;
    },

    closeTree() {
      this._persistent.tree.open = false;
    },

    toggleContext(ctx: KubeContext) {
      const view = _getOrCreateContextNode(this._persistent.tree, ctx.name);
      view.open = !view.open;
    },

    toggleResourceGroup(ctx: KubeContext, group: KubeResourceGroup) {
      const view = _getOrCreateResourceGroupNode(this._persistent.tree, ctx.name, group.groupVersion);
      view.open = !view.open;
    },

    toggleResource(ctx: KubeContext, res: KubeResource) {
      const view = _getOrCreateResourceNode(this._persistent.tree, ctx.name, res.groupVersion, res.kind);
      view.open = !view.open;
    },

    setFilterExpr(f: string) {
      this._persistent.filterExpr = f.trim();
      this._persistent.filters = parseFilterExpr(this._persistent.filterExpr);
    },

    clearFilterExpr() {
      this._persistent.filterExpr = null;
      this._persistent.filters = [];
    },

    _initWatcher(ctx: KubeContext, res: KubeResource) {
      this._watchers[ctx.name] = this._watchers[ctx.name] || {};
      this._watchers[ctx.name][res.groupVersion + "/" + res.kind] = new ResourceWatcher(
        ctx,
        res,
        this.selector(ctx, res),
      );
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAllExplorerStore, import.meta.hot));
}

function _getOrCreateContextNode(tree: Tree, name: string): TreeNode {
  tree.contexts[name] = tree.contexts[name] || {
    open: undefined,
  };
  return tree.contexts[name];
}

function _getOrCreateResourceGroupNode(tree: Tree, ctxName: string, groupVersion: string): TreeNode {
  const key = `${ctxName}/${groupVersion}`;
  tree.resourceGroups[key] = tree.resourceGroups[key] || {
    open: false,
  };
  return tree.resourceGroups[key];
}

function _getOrCreateResourceNode(tree: Tree, ctxName: string, groupVersion: string, kind: string): TreeNode {
  const key = `${ctxName}/${groupVersion}/${kind}`;
  tree.resources[key] = tree.resources[key] || {
    open: false,
  };
  return tree.resources[key];
}
