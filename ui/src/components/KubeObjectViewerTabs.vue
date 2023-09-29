<script lang="ts" setup>
import { computed, markRaw, reactive, type Component } from "vue";

import type { KubeObject } from "../common/types";

import KubeObjectViewerEventsTab from "./KubeObjectViewerEventsTab.vue";
import KubeObjectViewerManifestTab from "./KubeObjectViewerManifestTab.vue";
import KubeObjectViewerPodInsightsTab from "./KubeObjectViewerPodInsightsTab.vue";

const props = defineProps<{
  object: KubeObject,
}>();

const tabs = computed(() => {
  const items = reactive([
    {
      name: "Manifest",
      component: markRaw(KubeObjectViewerManifestTab as Component),
      active: false,
      first: false,
    },
  ]);

  if (props.object.gvk.toString() === "v1/Pod") {
    items.unshift({
      name: "Insights",
      component: markRaw(KubeObjectViewerPodInsightsTab as Component),
      active: false,
      first: false,
    });
  }

  if (props.object.gvk.kind !== "Event") {
    items.push({
      name: "Events",
      component: markRaw(KubeObjectViewerEventsTab as Component),
      active: false,
      first: false,
    });
  }

  items[0].first = true;
  items[0].active = true;

  return items;
});

const activeTab = computed(() => {
  return tabs.value.find((t) => t.active) || tabs.value[0];
});

function toggleActive(tab: typeof tabs.value[0]) {
  tabs.value.forEach((t) => {
    t.active = false;
  });
  tab.active = true;
}
</script>

<template>
  <div class="flex flex-col">
    <div class="-mb-px flex-nowrap shrink-0 tabs z-10">
      <button
        v-for="t in tabs"
        :key="t.name"
        class="shrink-0 tab tab-lifted"
        :class="{
          'tab-active [--tab-border-color:#2d2d2d] ': t.active,
          'tab-active [--tab-bg:#2d2d2d] [--tab-color:hsl(var(--nc))]': t.active && t.name === 'Manifest',
          '[--tab-border-color:transparent]': !t.active,
        }"
        @click="toggleActive(t)"
      >
        {{ t.name }}
      </button>
      <div class="[--tab-border-color:transparent] cursor-default flex-1 mr-6 tab tab-lifted" />
    </div>
    <component
      :is="activeTab.component"
      class="border border-[#2d2d2d] flex flex-col grow relative rounded-b-md rounded-tr-md"
      :class="{
        'rounded-tl-md': !activeTab.first,
      }"
      :tab="activeTab"
      :object="object"
    />
  </div>
</template>

<style scoped>
</style>
