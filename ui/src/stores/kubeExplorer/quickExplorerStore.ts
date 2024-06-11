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

const gvkToQuickGroup = {
  "v1/Pod": "Workloads",
  "v1/ReplicationController": "Workloads",
  "apps/v1/DaemonSet": "Workloads",
  "apps/v1/Deployment": "Workloads",
  "apps/v1/ReplicaSet": "Workloads",
  "apps/v1/StatefulSet": "Workloads",
  "batch/v1/Job": "Workloads",
  "batch/v1/CronJob": "Workloads",

  "v1/Service": "Networking",
  "networking.k8s.io/v1/Ingress": "Networking",
  "networking.k8s.io/v1/IngressClass": "Networking",
  "networking.k8s.io/v1/NetworkPolicy": "Networking",

  "v1/ConfigMap": "Config and Secrets",
  "v1/Secret": "Config and Secrets",

  // "v1/PersistentVolume": "Storage",
  // "v1/PersistentVolumeClaim": "Storage",
  // "storage.k8s.io/v1/StorageClass": "Storage",

  "v1/ServiceAccount": "RBAC",
  "rbac.authorization.k8s.io/v1/ClusterRole": "RBAC",
  "rbac.authorization.k8s.io/v1/ClusterRoleBinding": "RBAC",
  "rbac.authorization.k8s.io/v1/Role": "RBAC",
  "rbac.authorization.k8s.io/v1/RoleBinding": "RBAC",

  "v1/Node": "Cluster",
  "v1/Namespace": "Cluster",
  "v1/Event": "Cluster",
  "apiextensions.k8s.io/v1/CustomResourceDefinition": "Cluster",

  // "apps/v1/ControllerRevision": "Other",
};

const quickGroupRank = {
  Workloads: 800,
  Networking: 750,
  "Config and Secrets": 600,
  Storage: 550,
  RBAC: 500,
  Cluster: 450,
  Other: 100,
};

export const useQuickExplorerStore = defineStore({
  id: "quickExplorerStore",

  state: () => ({
    _watchers: {} as Record<string, Record<string, ResourceWatcher>>,

    _focused: null as KubeObject | null,

    _persistent: useStorage(
      "quickExplorerStore",
      {
        tree: {
          open: true,
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
        const groups = useKubeDataStore().resourceGroups(ctx);

        return [...new Set(Object.values(gvkToQuickGroup))]
          .map((quickGroup) => ({
            groupVersion: quickGroup,
            resources: groups.flatMap((group) => (group.resources || []).filter((res) => gvkToQuickGroup[res.groupVersion + "/" + res.kind as keyof typeof gvkToQuickGroup] === quickGroup)),
          }))
          .filter((group) => filterResources(group.resources, this._persistent.filters).length > 0)
          .sort((a, b) => quickGroupRank[b.groupVersion as keyof typeof quickGroupRank] - quickGroupRank[a.groupVersion as keyof typeof quickGroupRank]);
      };
    },

    resources(): (ctx: KubeContext, group: KubeResourceGroup) => KubeResource[] {
      return (ctx, group) => {
        return filterResources((group.resources || []), this._persistent.filters)
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
  import.meta.hot.accept(acceptHMRUpdate(useQuickExplorerStore, import.meta.hot));
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
    open: true,
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
