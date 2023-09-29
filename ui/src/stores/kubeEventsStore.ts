import { defineStore, acceptHMRUpdate } from "pinia";

import type {
  CoreV1Event,
  KubeContext,
  KubeObject,
  KubeObjectMap,
} from "../common/types";

import { useKubeDataStore } from "./kubeDataStore";

export const useKubeEventsStore = defineStore({
  id: "kubeEventsStore",

  getters: {
    events(): (ctx: KubeContext) => KubeObject<CoreV1Event>[] {
      return (ctx) => {
        const kubeDataStore = useKubeDataStore();
        return Object.values(kubeDataStore.objects(ctx, kubeDataStore.resource(ctx, "v1", "Event")!) as KubeObjectMap<KubeObject<CoreV1Event>>)
          .sort((a, b) => a.raw.metadata.creationTimestamp.localeCompare(b.raw.metadata.creationTimestamp));
      };
    },
  },

  actions: {
    async watchEvents(ctx: KubeContext, selector?: object) {
      const kubeDataStore = useKubeDataStore();
      return await kubeDataStore.watchObjects(ctx, kubeDataStore.resource(ctx, "v1", "Event")!, selector);
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useKubeEventsStore, import.meta.hot));
}
