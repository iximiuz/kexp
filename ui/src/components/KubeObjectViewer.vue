<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from "vue";

import { useCleaner } from "../common/cleaner";
import { type KubeObject } from "../common/types";
import { useKubeDataStore } from "../stores";

import KubeObjectViewerActionBar from "./KubeObjectViewerActionBar.vue";
import KubeObjectViewerMenu from "./KubeObjectViewerMenu.vue";
import KubeObjectViewerTabs from "./KubeObjectViewerTabs.vue";
import Copyable from "./base/Copyable.vue";

const props = defineProps<{
  object: KubeObject
}>();

const kubeDataStore = useKubeDataStore();

const titleText = computed(() => {
  return `${props.object.gvk.kind} "${props.object.name}"`;
});

const subTitleText = computed(() => {
  if (props.object.deletedAt) {
    return "deleted";
  }
  if (props.object.gvk.toString() === "v1/Pod") {
    // Inintialized: 0/1
    // Ready: 0/1
    // return props.object.raw.status.phase + " / ready: " + ((props.object.raw.status.conditions || []).find((c) => c.type === "Ready") || { status: "False" }).status;
  }
  return `version ${props.object.raw.metadata.resourceVersion}`;
});

const objectClass = computed(() => {
  const created = props.object.isFreshlyCreated;
  const updated = props.object.isFreshlyUpdated;
  const deleted = !!props.object.raw.metadata.deletionTimestamp || props.object.deletedAt;
  return {
    "animate-pulse text-green-700": created,
    "animate-pulse text-amber-500": updated,
    "animate-pulse text-red-700": deleted,
    "text-slate-600": !created && !updated && !deleted,
  };
});

const cleaner = useCleaner();
onUnmounted(() => cleaner.cleanUp());

onMounted(async() => {
  // Hacky
  const contexts = kubeDataStore.contexts({ clusterUID: props.object.clusterUID });

  for (const ctx of contexts) {
    const unwatch = await kubeDataStore.watchObjects(ctx, props.object.resource, {
      name: props.object.name,
      namespace: props.object.namespace,
    }, (err) => {
      if (err) {
        console.error("KubeObjectViewer: watch inspected object error", props.object, err);
      }
    });
    cleaner.addCleanup(unwatch);
  }
});
</script>

<template>
  <div class="flex flex-col gap-y-2 h-full p-[5px]">
    <div class="pl-2 w-full">
      <div class="flex items-center justify-between">
        <a
          :key="object.rev"
          class="block font-semibold truncate"
          :class="objectClass"
        >
          <Copyable
            :title="titleText"
            class="truncate"
            :copy-text="object.name"
            :text="titleText"
          />
        </a>

        <KubeObjectViewerMenu :object="object" />
      </div>
      <div
        :title="subTitleText"
        class="text-slate-400 text-sm truncate"
      >
        {{ subTitleText }}
      </div>
    </div>

    <KubeObjectViewerActionBar
      :object="object"
      class="px-2"
    />

    <KubeObjectViewerTabs
      :object="object"
      class="grow min-h-0 min-w-0 mt-1"
    />
  </div>
</template>

<style scoped>
</style>
