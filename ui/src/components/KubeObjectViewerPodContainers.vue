<script lang="ts" setup>
import { computed, ref } from "vue";

import { reprContainerStatus } from "../common/repr";
import type { KubeObject, V1Pod, V1Container } from "../common/types";

const props = defineProps<{
  object: KubeObject<V1Pod>,
}>();

const initContainers = computed(() => {
  return props.object.raw.spec!.initContainers || [];
});

const regularContainers = computed(() => {
  return props.object.raw.spec!.containers || [];
});

const ephemeralContainers = computed(() => {
  return props.object.raw.spec!.ephemeralContainers || [];
});

const hoveredEphemeral = ref<V1Container & { targetContainerName?: string } | null>(null);

function _containerClass(c: V1Container, kind: "ephemeral" | "init" | "sidecar" | "regular"): string[] {
  if (kind === "init" && (c as { restartPolicy?: string }).restartPolicy === "Always") {
    kind = "sidecar";
  }

  const classes = ["container-" + reprContainerStatus(props.object.raw, c.name, { kind }).status];

  if (kind !== "ephemeral" && hoveredEphemeral.value && hoveredEphemeral.value.targetContainerName) {
    if (hoveredEphemeral.value.targetContainerName === c.name) {
      classes.push("opacity-100");
    } else {
      classes.push("opacity-50");
    }
  }

  return classes;
}

function _containerTooltip(c: V1Container, kind: "ephemeral" | "init" | "sidecar" | "regular"): string {
  if (kind === "init" && (c as { restartPolicy?: string }).restartPolicy === "Always") {
    kind = "sidecar";
  }

  const status = reprContainerStatus(props.object.raw, c.name, { kind });
  const tooltip = [`${c.name}${kind === "regular" ? "" : ` (${kind})`}: ${status.title}`];

  if (status.reason && status.message) {
    tooltip.push(`(${status.reason} - ${status.message})`);
  } else if (status.reason) {
    tooltip.push(`(${status.reason})`);
  } else if (status.message) {
    tooltip.push(`(${status.message})`);
  }

  return tooltip.join(" ");
}

function onEphemeralContainerHover(container: V1Container, enter: boolean) {
  if (enter) {
    hoveredEphemeral.value = container;
  } else {
    hoveredEphemeral.value = null;
  }
}
</script>

<template>
  <div>
    <div
      :key="object.rev"
      class="border-black border-l-2 border-t-2 flex rounded-md"
      :class="{
        'no-init-containers': initContainers.length === 0,
      }"
    >
      <div
        v-for="(ic, idx) in initContainers"
        :key="ic.name"
        class="!tooltip-right border-b-2 border-r-2 init-container w-[2rem]"
        :data-tip="_containerTooltip(ic, 'init')"
        :class="_containerClass(ic, 'init')"
        :style="{
          'z-index': 130 - idx,
        }"
      >
        <div class="-rotate-90">
          <template v-if="ic.name.length <= 2 * regularContainers.length - 1">
            {{ ic.name }}
          </template>
          <template v-else>
            {{ ic.name.substring(0, 2 * regularContainers.length - 1) }}&hellip;
          </template>
        </div>
      </div>
      <div class="flex flex-col grow">
        <div
          v-for="(c, idx) in regularContainers"
          :key="c.name"
          class="border-b-2 border-r-2 container h-[2rem]"
          :data-tip="_containerTooltip(c, 'regular')"
          :class="_containerClass(c, 'regular')"
          :style="{
            'z-index': 100 + idx,
          }"
        >
          {{ c.name }}
        </div>
      </div>
    </div>
    <div
      v-if="ephemeralContainers.length"
      class="border-black border-l-2 border-t-2 flex flex flex-col grow mt-2 rounded-md"
    >
      <div
        v-for="(c, idx) in ephemeralContainers"
        :key="c.name"
        class="!tooltip-bottom border-b-2 border-r-2 ephemeral-container grow h-[2.1rem] px-2"
        :data-tip="_containerTooltip(c, 'ephemeral')"
        :class="_containerClass(c, 'ephemeral')"
        :style="{
          'z-index': 200 - idx,
        }"
        @mouseenter="onEphemeralContainerHover(c, true)"
        @mouseleave="onEphemeralContainerHover(c, false)"
      >
        {{ c.name }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.container, .init-container, .ephemeral-container {
  @apply text-base-content;
  @apply tooltip;
  @apply border-black;
  @apply cursor-pointer;
  @apply flex;
  @apply font-semibold;
  @apply items-center;
  @apply justify-center;

  font-family: -apple-system, "system-ui", sans-serif;
  /* @apply font-mono; */
}

/* first init container has rounded left */
.init-container:first-child {
  border-top-left-radius: 0.25rem;
  border-bottom-left-radius: 0.25rem;
}

.container:first-child,
.ephemeral-container:first-child {
  border-top-right-radius: 0.25rem;
}
.container:last-child,
.ephemeral-container:last-child {
  border-bottom-right-radius: 0.25rem;
}

.no-init-containers .container:first-child,
.ephemeral-container:first-child {
  border-top-left-radius: 0.25rem;
}
.no-init-containers .container:last-child,
.ephemeral-container:last-child {
  border-bottom-left-radius: 0.25rem;
}
</style>
