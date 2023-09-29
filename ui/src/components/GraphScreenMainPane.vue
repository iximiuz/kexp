<script setup>
import { onMounted, ref, watch } from "vue";

import { useKubeGraphStore } from "../stores";

import KubeObjectsGraph from "./KubeObjectsGraph.vue";

const kubeGraphStore = useKubeGraphStore();

const graph = ref(null);

onMounted(async() => {
  watch(() => kubeGraphStore.objects, (objects) => {
    if (!graph.value) {
      return;
    }

    const byIdent = {};
    for (const obj of objects) {
      byIdent[obj.ident] = obj;
    }

    for (const curObj of graph.value.currentObjects()) {
      if (!byIdent[curObj.ident]) {
        graph.value.removeObject(curObj);
      }
    }

    for (const obj of objects) {
      graph.value.upsertObject(obj);
    }
  }, { immediate: true });

  watch(() => kubeGraphStore.highlighted, (objects) => {
    if (!graph.value) {
      return;
    }

    graph.value.highlightGroup(objects);
  }, { immediate: true });
});
</script>

<template>
  <KubeObjectsGraph ref="graph" />
</template>
