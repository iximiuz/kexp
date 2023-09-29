<script lang="ts" setup>
import { ArrowsPointingInIcon, TrashIcon, WrenchScrewdriverIcon } from "@heroicons/vue/24/outline";

import type { KubeObject } from "../common/types";
import { useAppStore, useKubeDataStore } from "../stores";

import KubeObjectViewerActionBarButtonGeneric from "./KubeObjectViewerActionBarButtonGeneric.vue";
import KubeObjectViewerActionBarButtonWatch from "./KubeObjectViewerActionBarButtonWatch.vue";

const props = defineProps<{
  object: KubeObject
}>();

const appStore = useAppStore();
const kubeDataStore = useKubeDataStore();

const actions = [
  {
    name: "Show in Explorer",
    disabled: isDeleted,
    onClick: () => {
      alert("Coming soon!");
    },
    component: KubeObjectViewerActionBarButtonGeneric,
    icon: ArrowsPointingInIcon,
  },
  {
    name: "Watch for changes",
    disabled: isDeleted,
    component: KubeObjectViewerActionBarButtonWatch,
  },
  {
    name: "Open in Request Builder",
    disabled: isDeleted,
    onClick: () => {
      appStore.openRequestBuilder(props.object);
    },
    component: KubeObjectViewerActionBarButtonGeneric,
    icon: WrenchScrewdriverIcon,
  },
  {
    name: "Delete object",
    disabled: isDeleted,
    onClick: async() => {
      await kubeDataStore.deleteObject(null, props.object);
    },
    component: KubeObjectViewerActionBarButtonGeneric,
    icon: TrashIcon,
    extraClassWrapper: ["ml-auto"],
    extraClassIcon: ["hover:text-error"],
  },
];

function isDeleted() {
  return !!(props.object.raw.metadata.deletionTimestamp || props.object.deletedAt);
}
</script>

<template>
  <div
    :key="object.rev"
    class="flex gap-x-1"
  >
    <component
      :is="action.component"
      v-for="action in actions"
      :key="action.name"
      :action="action"
      :object="object"
    />
  </div>
</template>

<style scoped>
</style>
