<script lang="ts" setup>
import { computed } from "vue";

import { reprTimeRelative } from "../common/repr";
import type { KubeObject, V1Pod } from "../common/types";

const props = defineProps<{
  object: KubeObject<V1Pod>,
}>();

const conditions = computed(() => {
  return (props.object.raw.status!.conditions || []).sort((a, b) => {
    return ("" + b.lastTransitionTime).localeCompare(a.lastTransitionTime + "");
  });
});
</script>

<template>
  <table class="table table-pin-cols table-pin-rows table-xs">
    <thead>
      <tr>
        <td class="pt-4">
          Type
        </td>
        <td class="pt-4">
          Status
        </td>
        <td class="pt-4">
          Time
        </td>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(c, idx) in conditions"
        :key="idx"
      >
        <td>{{ c.type }}</td>
        <td>{{ c.status }}</td>
        <td
          :title="c.lastTransitionTime + ''"
          class="whitespace-nowrap"
        >
          {{ reprTimeRelative(c.lastTransitionTime + '') }} ago
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
td {
  font-size: 1rem;
}
</style>
