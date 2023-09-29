<script lang="ts" setup>
import { CheckIcon, EyeIcon, EyeSlashIcon, FunnelIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { computed, ref } from "vue";

import type { KubeContext, KubeResource } from "../common/types";

import KubeExplorerExpandableItem from "./KubeExplorerExpandableItem.vue";
import KubeExplorerResourceObjectsItem from "./KubeExplorerResourceObjectsItem.vue";
import HandyButton from "./base/HandyButton.vue";

const props = defineProps<{
  context: KubeContext,
  resource: KubeResource,
  store: {
    isResourceOpen:(ctx: KubeContext, res: KubeResource) => boolean,
    isResourceWatched?: (ctx: KubeContext, res: KubeResource) => boolean,
    setResourceSelector?: (ctx: KubeContext, res: KubeResource, selector: {
      namespace?: string,
      labels?: string,
      fields?: string,
    }) => Promise<void>,
    toggleResource: (ctx: KubeContext, res: KubeResource) => void,
    unwatchResource?: (ctx: KubeContext, res: KubeResource) => Promise<void>,
    watchResource?: (ctx: KubeContext, res: KubeResource) => Promise<void>,
    selector: (ctx: KubeContext, res: KubeResource) => {
      namespace?: string,
      labels?: string,
      fields?: string,
    },
  },
}>();

const watchSupported = props.store.isResourceWatched !== undefined;
const watchHovered = ref(false);

const watched = computed(() => props.store.isResourceWatched && props.store.isResourceWatched(props.context, props.resource));

async function toggleWatch() {
  if (!props.store.watchResource || !props.store.unwatchResource) {
    return;
  }

  watchHovered.value = false;

  if (watched.value) {
    await props.store.unwatchResource(props.context, props.resource);
  } else {
    await props.store.watchResource(props.context, props.resource);
  }
}

const watchIcon = computed(() => {
  return watched.value && watchHovered.value
    ? EyeSlashIcon
    : EyeIcon;
});

const selectorSupported = props.store.setResourceSelector !== undefined;
const selectorEditorOpen = ref(false);
const selectorSaving = ref(false);

const selector = ref({
  namespace: selectorSupported ? props.store.selector(props.context, props.resource).namespace : undefined,
  labels: selectorSupported ? props.store.selector(props.context, props.resource).labels : undefined,
  fields: selectorSupported ? props.store.selector(props.context, props.resource).fields : undefined,
});

const selectorIsEmpty = computed(() => !selector.value.namespace && !selector.value.labels && !selector.value.fields);

async function setSelector() {
  if (!props.store.setResourceSelector) {
    return;
  }

  selectorSaving.value = true;

  await props.store.setResourceSelector(props.context, props.resource, selector.value);

  selectorSaving.value = false;
  selectorEditorOpen.value = false;
}

function cancelSelectorEditing() {
  selectorEditorOpen.value = false;

  selector.value = {
    namespace: props.store.selector(props.context, props.resource).namespace,
    labels: props.store.selector(props.context, props.resource).labels,
    fields: props.store.selector(props.context, props.resource).fields,
  };
}

function toggleItem() {
  if (!selectorEditorOpen.value) {
    props.store.toggleResource(props.context, props.resource);
  }
}
</script>

<template>
  <KubeExplorerExpandableItem
    :toggle="toggleItem"
    :highlightable="true"
    :locked="selectorEditorOpen"
    :is-open="store.isResourceOpen(context, resource)"
  >
    <template #title>
      <div class="flex flex-col min-w-0 w-full">
        <div class="flex group grow items-center justify-between min-w-0">
          <span
            :title="resource.kind"
            class="truncate"
          >
            {{ resource.kind }}
          </span>

          <div
            v-if="!selectorEditorOpen"
            class="flex gap-x-1 pl-2 shrink-0"
          >
            <HandyButton
              v-if="selectorSupported"
              class="bg-transparent border-none btn-ghost btn-square btn-xs h-4 hover:bg-transparent items-center justify-center shrink-0 w-4"
              :on-click="() => { selectorEditorOpen = true; }"
              :class="{
                'hidden group-hover:flex': selectorIsEmpty,
              }"
            >
              <FunnelIcon class="hover:opacity-100 opacity-60 stroke-[2.5px]" />
            </HandyButton>
            <HandyButton
              v-if="watchSupported"
              :on-click="toggleWatch"
              class="bg-transparent border-none btn-ghost btn-square btn-xs h-4 hover:bg-transparent items-center justify-center shrink-0 w-4"
              :class="{
                'hidden group-hover:flex': !watched,
              }"
              @mouseenter="watchHovered = true"
              @mouseleave="watchHovered = false"
            >
              <component
                :is="watchIcon"
                class="hover:opacity-100 opacity-60 stroke-[2.5px]"
              />
            </HandyButton>
          </div>
        </div>

        <div
          v-if="selectorSupported"
          class="duration-150 ease-in-out join join-vertical transition-all"
          :class="{
            'h-0 overflow-hidden': !selectorEditorOpen,
            'h-[105px]': selectorEditorOpen,
          }"
        >
          <input
            v-model="selector.namespace"
            class="!rounded-none focus:!outline-none input input-bordered input-sm join-item"
            placeholder="Namespace default"
          >
          <input
            v-model="selector.labels"
            class="!rounded-none focus:!outline-none input input-bordered input-sm join-item"
            placeholder="Label selector app=nginx"
          >
          <input
            v-model="selector.fields"
            class="!rounded-none focus:!outline-none input input-bordered input-sm join-item"
            placeholder="Field selector metadata.name=foo"
          >
          <div
            v-if="selectorEditorOpen"
            class="flex items-center justify-end"
          >
            <span>&nbsp;</span>
            <HandyButton
              class="border-none btn-ghost btn-square btn-xs focus:!outline-none focus:bg-base-content/20 h-[20px] rounded-md w-[20px]"
              :on-click="setSelector"
            >
              <CheckIcon class="h-4 stroke-[2.5px] w-4" />
            </HandyButton>
            <HandyButton
              class="border-none btn-ghost btn-square btn-xs focus:!outline-none focus:bg-base-content/20 h-[20px] rounded-md w-[20px]"
              :on-click="cancelSelectorEditing"
            >
              <XMarkIcon class="h-4 stroke-[2.5px] w-4" />
            </HandyButton>
          </div>
        </div>
      </div>
    </template>

    <KubeExplorerResourceObjectsItem
      v-if="!selectorSaving"
      :context="context"
      :resource="resource"
      :store="store"
    />
  </KubeExplorerExpandableItem>
</template>

<style scoped>
</style>
