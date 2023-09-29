<script lang="ts" setup>
import { onMounted, ref } from "vue";

import GraphScreen from "./components/GraphScreen.vue";
import { useAppStore, useKubeDataStore, useKubeWatchStore } from "./stores";

const appStore = useAppStore();
const kubeDataStore = useKubeDataStore();
const kubeWatchStore = useKubeWatchStore();

const loading = ref(true);
const error = ref("");

async function load() {
  await kubeDataStore.fetchContexts();
  await Promise.all(kubeDataStore.contexts().map(async(c) => await kubeDataStore.fetchResources(c)));

  await kubeWatchStore.load(kubeDataStore.contexts());

  loading.value = false;
}

let backoff = 100;

onMounted(async() => {
  if (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || "")) {
    document.body.classList.add("platform-mac");
  }

  appStore.init();

  for (let i = 0; i < 30; i++) {
    error.value = "";

    try {
      return await load();
    } catch (e) {
      error.value = `${e}`;
      console.error(e);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, 5000);
    }
  }
});
</script>

<template>
  <div
    v-if="loading"
    class="flex h-screen items-center justify-center"
  >
    <progress class="progress w-56" />
  </div>

  <div
    v-else-if="error"
    class="flex h-screen items-center justify-center"
  >
    <span class="text-lg">{{ error }}</span>
  </div>

  <GraphScreen
    v-else
    class="min-w-[600px]"
  />
</template>

<style>
</style>
