<script lang="ts" setup>
import { computed } from "vue";

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

function _containerClass(c: V1Container, kind: "init" | "sidecar" | "regular"): string[] {
  if (kind === "init" && (c as { restartPolicy?: string }).restartPolicy === "Always") {
    kind = "sidecar";
  }
  return ["container-" + reprContainerStatus(props.object.raw, c.name, { kind }).status];
}

function _containerTooltip(c: V1Container, kind: "init" | "sidecar" | "regular"): string {
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
</script>

<template>
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
      class="border-b-2 border-black border-r-2 cursor-pointer flex font-semibold init-container items-center justify-center text-base-content tooltip tooltip-right w-[2rem]"
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
        class="border-b-2 border-black border-r-2 container cursor-pointer flex flex font-semibold h-[2rem] items-center justify-center text-base-content tooltip"
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
</template>

<style scoped>
.container, .init-container {
  font-family: -apple-system, "system-ui", sans-serif;
  /* @apply font-mono; */
}

/* first init container has rounded left */
.init-container:first-child {
  border-top-left-radius: 0.25rem;
  border-bottom-left-radius: 0.25rem;
}

.container:first-child {
  border-top-right-radius: 0.25rem;
}
.container:last-child {
  border-bottom-right-radius: 0.25rem;
}

.no-init-containers .container:first-child {
  border-top-left-radius: 0.25rem;
}
.no-init-containers .container:last-child {
  border-bottom-left-radius: 0.25rem;
}
</style>
