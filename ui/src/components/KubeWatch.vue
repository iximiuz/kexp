<script lang="ts" setup>
import { EyeIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { computed } from "vue";

import {
  WATCH_KIND_OBJECT,
  WATCH_KIND_RESOURCE,
  WATCH_KIND_RELATED,
  WATCH_KIND_RELATED_OBJECT,
  WATCH_KIND_RELATED_RESOURCE,
  useKubeWatchStore,
  type Watch as KubeWatch,
} from "../stores";

import HandyButton from "./base/HandyButton.vue";

const kubeWatchStore = useKubeWatchStore();

interface Watch {
  watch: KubeWatch,
  context: string,
  resource?: string,
  name?: string,
  namespace?: string,
  labelSelector?: string,
  fieldSelector?: string,
  relatedTo?: string,
}

const watches = computed(() => {
  const res: Watch[] = [];

  for (const w of kubeWatchStore.watches()) {
    switch (w.kind) {
    case WATCH_KIND_OBJECT:
      res.push({
        watch: w,
        context: w.context,
        resource: w.object.resource.groupVersion + "/" + w.object.resource.kind,
        name: w.object.name,
        namespace: w.object.namespace,
      });
      break;

    case WATCH_KIND_RESOURCE:
      res.push({
        watch: w,
        context: w.context,
        resource: w.resource.groupVersion + "/" + w.resource.kind,
        namespace: w.selector && w.selector.namespace,
        labelSelector: w.selector && w.selector.labels,
        fieldSelector: w.selector && w.selector.fields,
      });
      break;

    case WATCH_KIND_RELATED:
      res.push({
        watch: w,
        context: w.context,
        relatedTo: w.target.resource.kind + " " + w.target.name,
      });
      break;

    case WATCH_KIND_RELATED_OBJECT:
      res.push({
        watch: w,
        context: w.context,
        resource: w.object.resource.groupVersion + "/" + w.object.resource.kind,
        name: w.object.name,
        namespace: w.object.namespace,
        relatedTo: w.target.resource.kind + " " + w.target.name,
      });
      break;

    case WATCH_KIND_RELATED_RESOURCE:
      res.push({
        watch: w,
        context: w.context,
        resource: w.resource.groupVersion + "/" + w.resource.kind,
        relatedTo: w.target.resource.kind + " " + w.target.name,
      });
      break;
    }
  }

  return res;
});
</script>

<template>
  <div
    class="flex flex-col"
    @mouseleave="kubeWatchStore.unhighlightWatch()"
  >
    <div class="!text-primary-content/70 border-b border-b-base-300 leading-[24px] px-[1.1rem] py-1 select-none shadow-sm shrink-0 text-sm uppercase">
      Watches
    </div>
    <div
      v-if="watches.length === 0"
      class="p-2 select-none"
    >
      Nothing is being watched right now. Try clicking on <EyeIcon class="h-[1rem] inline w-[1rem]" /> in the Explorer.
    </div>
    <ul
      v-else
      class="flex flex-col min-h-0 overflow-y-auto scrollbar-styled"
    >
      <li
        v-for="w in watches"
        :key="w.watch.id"
        class="cursor-pointer flex flex-col group hover:bg-primary/20 min-w-0 px-[0.55rem] py-2"
        @mouseenter="kubeWatchStore.highlightWatch(w.watch)"
        @mouseleave="kubeWatchStore.unhighlightWatch()"
      >
        <div class="font-semibold truncate">
          {{ w.resource ? w.resource : "All objects" }}
          <HandyButton
            class="border-none btn-ghost btn-square btn-xs float-right focus:bg-base-content/20 group-hover:flex hidden items-center justify-center rounded-md"
            :on-click="async() => await kubeWatchStore.removeWatch(w.watch)"
          >
            <XMarkIcon class="h-[1.2rem] stroke-[2.5px] w-[1.2rem]" />
          </HandyButton>
        </div>
        <div
          v-if="w.namespace"
          class="ml-2 truncate"
        >
          in namespace <span class="font-semibold">{{ w.namespace }}</span>
        </div>
        <div
          v-if="w.name"
          class="ml-2 truncate"
        >
          named <span class="font-semibold">{{ w.name }}</span>
        </div>
        <div
          v-if="w.labelSelector"
          class="ml-2 truncate"
        >
          with labels <span class="font-semibold">{{ w.labelSelector }}</span>
        </div>
        <div
          v-if="w.fieldSelector"
          class="ml-2 truncate"
        >
          with fields <span class="font-semibold">{{ w.fieldSelector }}</span>
        </div>
        <div
          v-if="w.relatedTo"
          class="ml-2 truncate"
        >
          related to <span class="font-semibold">{{ w.relatedTo }}</span>
        </div>
        <div class="ml-2 truncate">
          using context <span class="font-semibold">{{ w.context }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>
