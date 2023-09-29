import { defineStore, acceptHMRUpdate } from "pinia";

import type {
  KubeContext,
  KubeObject,
  KubeResource,
  KubeResourceGroup,
} from "../../common/types";

import { useKubeDataStore } from "../kubeDataStore";
import { useKubeWatchStore } from "../kubeWatchStore";

import { filterObjects, filterResources, filterResourceGroups, isApplicableObjectFilterExpr } from "./filter";
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

export const useWatchedExplorerStore = defineStore({
  id: "watchedExplorerStore",

  state: () => ({
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
    contexts: () => {
      return () => {
        const names = new Set(useKubeWatchStore().contexts());
        return useKubeDataStore().contexts()
          .filter((ctx) => names.has(ctx.name))
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    },

    resourceGroups(): (ctx: KubeContext) => KubeResourceGroup[] {
      return (ctx: KubeContext) => {
        return filterResourceGroups(useKubeDataStore().resourceGroups(ctx), this.filterExpr)
          .filter((group) => (group.resources || []).some((res) => this.objects(ctx, res).length > 0))
          .sort((a, b) => a.groupVersion.localeCompare(b.groupVersion));
      };
    },

    resources(): (ctx: KubeContext, group: KubeResourceGroup) => KubeResource[] {
      return (ctx: KubeContext, group: KubeResourceGroup) => {
        return filterResources(group.resources || [], this.filterExpr)
          .filter((res) => this.objects(ctx, res).length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    },

    objects() {
      return (ctx: KubeContext, res: KubeResource) => {
        return filterObjects(useKubeWatchStore().objects(ctx, res), this.filterExpr)
          .sort((a, b) => a.name.localeCompare(b.name));
      };
    },

    focused: (state) => {
      return state._focused;
    },

    isTreeOpen: (state) => {
      return state.tree.open;
    },

    isContextOpen() {
      return (ctx: KubeContext) => !!_getOrCreateContextNode(this.tree, ctx.name).open;
    },

    isResourceGroupOpen() {
      return (ctx: KubeContext, group: KubeResourceGroup) => !!this.filterExpr ||
        !!_getOrCreateResourceGroupNode(this.tree, ctx.name, group.groupVersion).open;
    },

    isResourceOpen: (state) => {
      return (ctx: KubeContext, res: KubeResource) => (!!state.filterExpr && isApplicableObjectFilterExpr(res, state.filterExpr)) ||
        !!_getOrCreateResourceNode(state.tree, ctx.name, res.groupVersion, res.kind).open;
    },
  },

  actions: {
    async loadContexts() {
      // no-op
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async loadResources(ctx: KubeContext) {
      // no-op
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async loadObjects(ctx: KubeContext, res: KubeResource) {
      // no-op
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async releaseObjects(ctx: KubeContext, res: KubeResource) {
      // no-op
    },

    openTree() {
      this.tree.open = true;
    },

    toggleTree() {
      this.tree.open = !this.tree.open;
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

    async setFocusedObject(ko: KubeObject) {
      if (this._focused) {
        if (ko && ko.ident === this._focused.ident) {
          return;
        }

        delete this._focused.focused;
      }

      useRelatedExplorerStore().setTargetObject(ko);

      if (ko) {
        this._focused = ko;
        this._focused.focused = true;
      }
    },

    setFilterExpr(f: string) {
      this.filterExpr = f.trim();
    },

    clearFilterExpr() {
      this.filterExpr = null;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWatchedExplorerStore, import.meta.hot));
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
