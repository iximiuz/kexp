<script setup>
import { computed, onMounted, onUnmounted, watch } from "vue";

import { useKubeGraphStore } from "../stores";

import KubeExplorerObjectList from "./KubeExplorerObjectList.vue";
import SimpleLoader from "./base/SimpleLoader.vue";

const kubeGraphStore = useKubeGraphStore();

const props = defineProps({
  context: { type: Object, required: true },
  resource: { type: Object, required: true },
  store: { type: Object, required: true },
});

const graphKey = computed(() => {
  return `kube-explorer-${props.store.$id}-${props.context.name}-${props.resource.namespace}/${props.resource.name}`;
});

onMounted(() => {
  watch(() => props.store.objects(props.context, props.resource), (objects) => {
    kubeGraphStore.removeAllObjects(graphKey.value);

    for (const o of objects) {
      kubeGraphStore.upsertObject(graphKey.value, o);
    }
  }, { immediate: true });
});

onUnmounted(async() => {
  await props.store.releaseObjects(props.context, props.resource);
  kubeGraphStore.removeAllObjects(graphKey.value);
});

const namespacedObjects = computed(() => {
  const namespaced = {};
  for (const o of props.store.objects(props.context, props.resource)) {
    namespaced[o.namespace] = namespaced[o.namespace] || [];
    namespaced[o.namespace].push(o);
  }
  return Object.keys(namespaced).sort().map((ns) => {
    return {
      name: ns,
      objects: namespaced[ns].sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
});
</script>

<template>
  <SimpleLoader
    :load="() => store.loadObjects(context, resource)"
    loading-class="ml-4"
    error-class="ml-4"
  >
    <p
      v-if="store.objects(context, resource).length === 0"
      class="block cursor-default font-light opacity-70 pl-4"
    >
      (empty)
    </p>
    <ul
      v-else-if="resource.namespaced"
      class="border-l border-neutral-content/40"
    >
      <li
        v-for="ns in namespacedObjects"
        :key="ns.name"
        class="pl-[0.55rem]"
      >
        <h6
          class="cursor-default pl-1 pr-2 text-info/70 truncate"
          :title="ns.name"
        >
          namespace "{{ ns.name }}"
        </h6>
        <KubeExplorerObjectList
          :context="context"
          :objects="ns.objects"
          :store="store"
        />
      </li>
    </ul>
    <ul
      v-else
      class="border-l border-neutral-content/40"
    >
      <li class="pl-[0.55rem]">
        <h6 class="cursor-default pl-1 pr-2 text-info/70 truncate">
          (cluster-scoped)
        </h6>
        <KubeExplorerObjectList
          :context="context"
          :objects="store.objects(context, resource)"
          :store="store"
        />
      </li>
    </ul>
  </SimpleLoader>
</template>

<style scoped>
</style>
