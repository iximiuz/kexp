<script lang="ts" setup>
import { EyeIcon } from "@heroicons/vue/24/outline";
import { computed } from "vue";

import { isApplicationKindOfResource } from "../common/relations";
import type { KubeContext, KubeObject } from "../common/types";
import { useKubeDataStore, useKubeWatchStore } from "../stores";
import { WATCH_PRESET_APPLICATION } from "../stores/kubeWatchStore";

const props = defineProps<{
  object: KubeObject;
  action: {
    name: string;
    disabled?:() => boolean;
    available?: () => boolean;
    extraClassWrapper?: string[];
    extraClassIcon?: string[];
  };
}>();

const kubeDataStore = useKubeDataStore();
const kubeWatchStore = useKubeWatchStore();

const contexts = computed(() => {
  return kubeDataStore.contexts({
    clusterUID: props.object.clusterUID,
  });
});

function toggleObjectWatch(ctx: KubeContext) {
  const w = kubeWatchStore.getObjectWatch(ctx, props.object.descriptor);
  if (w) {
    kubeWatchStore.removeWatch(w);
  } else {
    kubeWatchStore.addObjectWatch(ctx, props.object.descriptor);
  }
}

function isObjectWatched(ctx: KubeContext) {
  return !!kubeWatchStore.getObjectWatch(ctx, props.object.descriptor);
}

function toggleRelatedWatch(ctx: KubeContext, preset?: string) {
  const w = kubeWatchStore.getRelatedWatch(ctx, props.object.descriptor, preset);
  if (w) {
    kubeWatchStore.removeWatch(w);
  } else {
    kubeWatchStore.addRelatedWatch(ctx, props.object.descriptor, preset);
  }
}

function isRelatedWatched(ctx: KubeContext, preset?: string) {
  return !!kubeWatchStore.getRelatedWatch(ctx, props.object.descriptor, preset);
}
</script>

<template>
  <div
    class="tooltip tooltip-left"
    :data-tip="action.name"
    :class="action.extraClassWrapper"
  >
    <div class="dropdown dropdown-bottom">
      <label
        :disabled="action.disabled && action.disabled() || undefined"
        tabindex="0"
        class="btn btn-outline btn-sm btn-square"
      >
        <EyeIcon class="h-5 w-5" />
      </label>
      <ul
        tabindex="0"
        class="bg-base-200 border border-primary-content/40 dropdown-content max-w-[280px] menu menu-sm mr-4 px-0 py-2 rounded-md shadow-lg shadow-primary-content z-40"
      >
        <li
          v-for="ctx in contexts"
          :key="ctx.name"
        >
          <details open>
            <summary class="pr-4 rounded-none">
              <div class="flex min-w-0">
                <a class="leading-[1.8rem] text-[1rem] truncate">Using context&nbsp;<span class="font-semibold">{{ ctx.name }}</span></a>
              </div>
            </summary>
            <ul class="px-0 py-2">
              <li @click="toggleObjectWatch(ctx)">
                <a class="flex items-center leading-[1.8rem] rounded-none text-[1rem] truncate">
                  {{ isObjectWatched(ctx) ? "Unwatch" : "Watch" }} this object
                </a>
              </li>
              <li
                v-if="isApplicationKindOfResource(object.gvk.toString())"
                @click="toggleRelatedWatch(ctx, WATCH_PRESET_APPLICATION)"
              >
                <a class="flex items-center leading-[1.8rem] rounded-none text-[1rem] truncate">
                  {{ isRelatedWatched(ctx, WATCH_PRESET_APPLICATION) ? "Unwatch" : "Watch" }} preset "Application"
                </a>
              </li>
              <li @click="toggleRelatedWatch(ctx)">
                <a class="flex items-center leading-[1.8rem] rounded-none text-[1rem] truncate">
                  {{ isRelatedWatched(ctx) ? "Unwatch" : "Watch" }} preset "Related objects"
                </a>
              </li>
            </ul>
          </details>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
</style>
