/* eslint-disable @typescript-eslint/ban-ts-comment */
import { defineStore, acceptHMRUpdate } from "pinia";

import type { KubeObject } from "../common/types";

import { useAllExplorerStore } from "./kubeExplorer/allExplorerStore";
import { useQuickExplorerStore } from "./kubeExplorer/quickExplorerStore";

export const useAppStore = defineStore({
  id: "appStore",

  state: () => ({
    inspectedKubeObject: null as KubeObject | null,

    requestBuilder: null as {
      kubeObject: KubeObject | null;
    } | null,
  }),

  getters: {
  },

  actions: {
    init() {
      // @ts-ignore-next-line
      this.biXdm.init();

      // @ts-ignore-next-line
      this.biXdm.addHandler("kube-explorer.filter", (params: { explorer: string; filterExpr: string }) => {
        const toClose = (params.explorer === "quick")
          ? useAllExplorerStore()
          : useQuickExplorerStore();

        const toOpen = (params.explorer === "quick")
          ? useQuickExplorerStore()
          : useAllExplorerStore();

        toClose.closeTree();
        toOpen.openTree();
        toOpen.setFilterExpr(params.filterExpr);
      });
    },

    setInspectedKubeObject(ko: KubeObject | null) {
      this.inspectedKubeObject = ko;
    },

    openRequestBuilder(ko: KubeObject | null) {
      this.requestBuilder = {
        kubeObject: ko,
      };
    },

    async requestWebTerm(): Promise<string> {
      // @ts-ignore-next-line
      return await this.biXdm.call("new-web-term-session");
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
}
