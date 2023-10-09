<script setup>
import { computed, onMounted, ref, watch } from "vue";

import { useAppStore } from "../stores";

import KubeObjectViewer from "./KubeObjectViewer.vue";

const props = defineProps({
  maxWidth: { type: Number, required: true },
});

const appStore = useAppStore();

const containerRef = ref(null);
const hResizerRef = ref(null);
const hResizing = ref(false);

const width = ref(0);
const minWidth = 350;

watch(() => props.maxWidth, (maxWidth) => {
  if (width.value > maxWidth) {
    width.value = maxWidth;
  }
  if (containerRef.value && containerRef.value.offsetWidth > maxWidth) {
    containerRef.value.style.flexBasis = maxWidth + "px";
  }
});

const showed = computed(() => !!appStore.inspectedKubeObject);

watch(showed, (showed) => {
  if (showed) {
    if (width.value < minWidth) {
      width.value = Math.max(minWidth, props.maxWidth / 3); // 1/3 of the screen's main pane width unless it's too small
    }
    if (width.value > props.maxWidth) {
      // Seems like sometimes maxWidth can be 0... Probably when the real screen size is not known upon the component's mount
      width.value = Math.max(minWidth, props.maxWidth);
    }
    containerRef.value.style["flex-basis"] = width.value + "px";
  } else {
    containerRef.value.style["flex-basis"] = "0px";
  }
});

onMounted(() => {
  containerRef.value.style["flex-basis"] = width.value + "px";

  hResizerRef.value.addEventListener("mousedown", (e) => {
    e.preventDefault();
    document.body.style["user-select"] = "none";
    document.body.style["pointer-events"] = "none";

    hResizing.value = true;

    const originalSize = containerRef.value.offsetWidth;
    const originalMousePosition = e.clientX;

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    function onMouseMove(e) {
      const mousePosition = e.clientX;

      width.value = Math.max(minWidth, Math.min(
        props.maxWidth,
        originalSize + (originalMousePosition - mousePosition),
      ));

      containerRef.value.style["flex-basis"] = width.value + "px";
    }

    function onMouseUp() {
      hResizing.value = false;
      document.body.style["user-select"] = "auto";
      document.body.style["pointer-events"] = "auto";

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
  });
});
</script>

<template>
  <div
    ref="containerRef"
    class="bg-base-100 border-l flex min-w-0 relative"
    :class="{
      'transition-all duration-150 ease-in-out': !hResizing,
      'border-neutral-content': showed,
      'border-transparent': !showed,
    }"
  >
    <div
      v-if="showed"
      class="flex grow h-full min-h-0 min-w-0"
    >
      <KubeObjectViewer
        :key="appStore.inspectedKubeObject.ident"
        class="grow min-h-0 min-w-0"
        :object="appStore.inspectedKubeObject"
      />
    </div>

    <div
      v-show="showed"
      ref="hResizerRef"
      class="-left-[2px] absolute bottom-0 delay-300 hover:bg-primary hover:cursor-col-resize top-0 w-[4px]"
      :class="{ 'bg-primary': hResizing }"
    />
  </div>
</template>

<style scoped>
</style>
