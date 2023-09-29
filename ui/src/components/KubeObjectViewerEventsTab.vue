<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from "vue";

import { useCleaner } from "../common/cleaner";
import { reprTimeRelative } from "../common/repr";
import type { CoreV1Event, KubeObject, KubeObjectMap } from "../common/types";

import { useKubeDataStore, useKubeEventsStore } from "../stores";

const kubeDataStore = useKubeDataStore();
const kubeEventsStore = useKubeEventsStore();

const props = defineProps<{
  object: KubeObject,
}>();

const cleaner = useCleaner();
onUnmounted(() => { cleaner.cleanUp(); });

onMounted(async() => {
  for (const ctx of kubeDataStore.contexts({ clusterUID: props.object.clusterUID })) {
    const fields = [
      "involvedObject.uid=" + props.object.raw.metadata.uid,
      "involvedObject.name=" + props.object.raw.metadata.name,
    ];
    if (props.object.raw.metadata.namespace) {
      fields.push("involvedObject.namespace=" + props.object.raw.metadata.namespace);
    }

    const unwatch = await kubeEventsStore.watchEvents(ctx, { fieldSelector: fields.join(",") });
    cleaner.addCleanup(unwatch);
  }
});

const events = computed(() => {
  const items: KubeObjectMap<KubeObject<CoreV1Event>> = {};
  for (const ctx of kubeDataStore.contexts({ clusterUID: props.object.clusterUID })) {
    for (const evt of kubeEventsStore.events(ctx)) {
      if (evt.raw.involvedObject.uid === props.object.raw.metadata.uid) {
        items[evt.ident] = evt;
      }
    }
  }
  return Object.values(items).sort((a, b) => {
    return a.raw.metadata.creationTimestamp!.localeCompare(b.raw.metadata.creationTimestamp!);
  });
});
</script>

<template>
  <div class="overflow-hidden">
    <div class="h-full overflow-auto scrollbar-styled w-full">
      <table class="table table-pin-cols table-pin-rows table-xs">
        <thead>
          <tr>
            <th class="pl-4 pt-4" />
            <td class="pt-4">
              Time
            </td>
            <td class="pt-4">
              Type
            </td>
            <td class="pt-4">
              Reason
            </td>
            <td class="pt-4">
              Message
            </td>
            <td class="pt-4">
              Count
            </td>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(e, idx) in events"
            :key="e.rev"
          >
            <th class="pl-4">
              {{ idx + 1 }}
            </th>
            <td
              :title="e.raw.metadata.creationTimestamp"
              class="whitespace-nowrap"
            >
              {{ reprTimeRelative(e.raw.metadata.creationTimestamp) }} ago
            </td>
            <td>{{ e.raw.type }}</td>
            <td>{{ e.raw.reason }}</td>
            <td
              class="max-w-[32ch] truncate"
              :title="e.raw.message"
            >
              {{ e.raw.message }}
            </td>
            <td>{{ e.raw.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
td {
  font-size: 1rem;
}
</style>
