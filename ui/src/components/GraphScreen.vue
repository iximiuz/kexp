<script lang="ts" setup>
import { onMounted, onUnmounted, reactive, ref } from "vue";

import { useAppStore, useKubeGraphStore, useKubeWatchStore } from "../stores";

import GraphScreenBottomBar from "./GraphScreenBottomBar.vue";
import GraphScreenBottomPane from "./GraphScreenBottomPane.vue";
import GraphScreenExtraPane from "./GraphScreenExtraPane.vue";
import GraphScreenMainPane from "./GraphScreenMainPane.vue";
import GraphScreenSidePanel from "./GraphScreenSidePanel.vue";

const appStore = useAppStore();
const kubeGraphStore = useKubeGraphStore();
const kubeWatchStore = useKubeWatchStore();

const bottomPaneRef = ref(null as HTMLElement & { toggle: () => void } | null);
const mainContainerRef = ref(null as HTMLElement | null);
let mainContainerResizeObserver = null as ResizeObserver | null;

const workbench = reactive({
  maxWidth: 500, // px, a safe guess until the real screen size is known
});

function adjustSizes() {
  if (mainContainerRef.value) {
    workbench.maxWidth = mainContainerRef.value.offsetWidth - 10; // margin
  }
}

onMounted(() => {
  adjustSizes();

  mainContainerResizeObserver = new ResizeObserver(adjustSizes);
  mainContainerResizeObserver.observe(mainContainerRef.value!);
});

onUnmounted(() => {
  if (mainContainerResizeObserver && mainContainerRef.value) {
    mainContainerResizeObserver.unobserve(mainContainerRef.value);
  }
});
</script>

<template>
  <div class="flex flex-col h-screen">
    <div class="flex grow min-h-0">
      <GraphScreenSidePanel />

      <div
        ref="mainContainerRef"
        class="basis-0 flex flex-col grow h-full justify-between min-w-[350px] shrink-0"
      >
        <div class="basis-0 flex grow items-stretch justify-end min-h-[260px] relative shrink-0">
          <GraphScreenExtraPane
            :max-width="workbench.maxWidth"
            class="z-30"
          />

          <GraphScreenMainPane
            v-if="!kubeGraphStore.isEmpty || !kubeWatchStore.isEmpty"
            class="absolute bottom-0 left-0 right-0 top-0"
          />
          <div
            v-else-if="!appStore.inspectedKubeObject"
            class="flex grow items-center justify-center select-none text-lg text-neutral-content"
          >
            <ul class="list-disc mx-[40px]">
              <li>Use explorer on the left to pick a Kubernetes object.</li>
              <li>Click on the graphed object to see its details and available actions.</li>
              <li>Watch for changes in objects that you are interested in.</li>
              <li>Automatically generate graphs of related objects via smart presets.</li>
              <li>Use the built-in terminal to run commands in the cluster.</li>
            </ul>
          </div>
        </div>

        <GraphScreenBottomPane ref="bottomPaneRef" />
      </div>
    </div>

    <GraphScreenBottomBar
      class="self-end w-full"
      :toggle-web-term="() => bottomPaneRef && bottomPaneRef.toggle()"
    />
  </div>
</template>

<style scoped>
</style>
