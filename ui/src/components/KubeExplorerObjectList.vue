<script lang="ts" setup>
import { DocumentTextIcon, EyeIcon, EyeSlashIcon } from "@heroicons/vue/24/outline";
import { onUnmounted, ref } from "vue";

import type {
  KubeContext,
  KubeObject,
} from "../common/types";

import { useAppStore } from "../stores";

import HandyButton from "./base/HandyButton.vue";

const props = defineProps<{
  context: KubeContext,
  objects: Array<KubeObject>,
  store: {
    focused: KubeObject | null,
    isObjectWatched?:(ctx: KubeContext, ko: KubeObject) => boolean,
    setFocusedObject: (ko: KubeObject | null) => Promise<void>,
    unwatchObject: (ctx: KubeContext, ko: KubeObject) => Promise<void>,
    watchObject: (ctx: KubeContext, ko: KubeObject) => Promise<void>,
  },
}>();

const appStore = useAppStore();

async function onObjectFocus(ko: KubeObject) {
  if (props.store.focused && props.store.focused.ident === ko.ident) {
    await props.store.setFocusedObject(null);
  } else {
    await props.store.setFocusedObject(ko);
  }
}

onUnmounted(() => {
  props.store.setFocusedObject(null);
});

function onObjectInspect(ko: KubeObject) {
  if (appStore.inspectedKubeObject && appStore.inspectedKubeObject.ident === ko.ident) {
    appStore.setInspectedKubeObject(null);
  } else {
    appStore.setInspectedKubeObject(ko);
  }
}

const watchSupported = props.store.isObjectWatched !== undefined;
const watchHovered = ref(false);

function watched(ko: KubeObject) {
  return props.store.isObjectWatched && props.store.isObjectWatched(props.context, ko);
}

async function toggleWatch(ko: KubeObject) {
  watchHovered.value = false;

  if (watched(ko)) {
    await props.store.unwatchObject(props.context, ko);
  } else {
    await props.store.watchObject(props.context, ko);
  }
}

function watchIcon(ko: KubeObject) {
  return watched(ko) && watchHovered.value
    ? EyeSlashIcon
    : EyeIcon;
}

const kubeObjectClass = (ko: KubeObject) => {
  const created = ko.isFreshlyCreated;
  const updated = ko.isFreshlyUpdated;
  const deleted = !!ko.raw.metadata.deletionTimestamp || ko.deletedAt;
  return {
    "animate-pulse text-green-700": created,
    "animate-pulse text-amber-500": updated,
    "animate-pulse text-red-700": deleted,
  };
};

const focused = (ko: KubeObject) => {
  return (props.store.focused || {}).ident === ko.ident;
};
</script>

<template>
  <ul class="border-l border-neutral-content/40">
    <li
      v-for="ko in objects"
      :key="ko.ident"
      class="cursor-pointer group"
      :class="[
        focused(ko) ? 'bg-primary/20' : 'hover:bg-primary/10',
      ]"
    >
      <a
        :title="(ko.namespace ? ko.namespace + '/' : '') + ko.name + ' (' + ko.raw.metadata.uid + ')'"
        class="flex gap-x-2 items-center justify-between min-w-0 pl-[0.55rem] pr-[1.2rem]"
        :class="kubeObjectClass(ko)"
        @click.stop.prevent="onObjectFocus(ko)"
      >
        <span class="truncate">
          {{ ko.name }}
        </span>
        <div class="flex gap-x-1">
          <HandyButton
            class="bg-transparent border-none btn-ghost btn-square btn-xs group-hover:flex h-4 hidden hover:bg-transparent items-center justify-center shrink-0 w-4"
            :on-click="() => onObjectInspect(ko)"
          >
            <DocumentTextIcon
              class="h-4 hover:opacity-100 opacity-60 stroke-[2.5px] w-4"
              @click.stop.prevent="onObjectInspect(ko)"
            />
          </HandyButton>
          <HandyButton
            v-if="watchSupported"
            :on-click="() => toggleWatch(ko)"
            class="bg-transparent border-none btn-ghost btn-square btn-xs h-4 hover:bg-transparent items-center justify-center shrink-0 w-4"
            :class="{
              'hidden group-hover:flex': !watched(ko),
            }"
            @mouseenter="watchHovered = true"
            @mouseleave="watchHovered = false"
          >
            <component
              :is="watchIcon(ko)"
              class="h-4 hover:opacity-100 opacity-60 stroke-[2.5px] w-4"
            />
          </HandyButton>
        </div>
      </a>
    </li>
  </ul>
</template>

<style scoped>
</style>
