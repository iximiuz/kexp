<script setup>
import { ChevronDownIcon, PlusIcon } from "@heroicons/vue/24/solid";
import { onMounted, ref } from "vue";

import WebTerm from "./WebTerm.vue";
import HandyButton from "./base/HandyButton.vue";

const showed = ref(false);

const webTermRef = ref(null);
const webTermShowed = ref(false);

const containerRef = ref(null);
const vResizerRef = ref(null);
const vResizing = ref(false);

// A resaonable default height.
const height = ref(140);
const minHeight = 80;

function open() {
  showed.value = true;
  webTermShowed.value = true;
  containerRef.value.style["flex-basis"] = height.value + "px";
}

function close() {
  showed.value = false;
  containerRef.value.style["flex-basis"] = "0px";
}

defineExpose({
  open,
  close,
  toggle: () => { showed.value ? close() : open(); },
});

onMounted(() => {
  if (showed.value) {
    containerRef.value.style["flex-basis"] = height.value;
  } else {
    containerRef.value.style["flex-basis"] = "0px";
  }

  vResizerRef.value.addEventListener("mousedown", (e) => {
    e.preventDefault();
    document.body.style["user-select"] = "none";
    document.body.style["pointer-events"] = "none";

    vResizing.value = true;

    const originalSize = containerRef.value.offsetHeight;
    const originalMousePosition = e.clientY;

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    function onMouseMove(e) {
      const mousePosition = e.clientY;
      const proposedHeight = originalSize + (originalMousePosition - mousePosition);

      if (showed.value) {
        if (proposedHeight < minHeight * 0.5) {
          close();
        } else {
          height.value = Math.max(minHeight, proposedHeight);
          containerRef.value.style["flex-basis"] = height.value + "px";
        }
      } else {
        if (proposedHeight > minHeight * 0.5) {
          height.value = Math.max(minHeight, proposedHeight);
          open();
        }
      }
    }

    function onMouseUp() {
      vResizing.value = false;
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
    class="flex flex-col min-h-0 relative"
    :class="{
      'transition-all duration-150 ease-in-out': !vResizing,
      'pointer-events-none': vResizing,
    }"
  >
    <div
      ref="vResizerRef"
      class="-top-[2px] absolute delay-300 h-[4px] hover:bg-primary left-0 right-0 z-40"
      :class="{
        'cursor-row-resize bg-primary': vResizing,
        'hover:cursor-row-resize': showed,
        'hover:cursor-n-resize': !showed,
      }"
    />

    <div
      v-show="showed"
      class="bg-base-100 border-neutral-content border-t flex flex-col grow overflow-hidden"
      :style="{
        'min-height': minHeight + 'px',
      }"
    >
      <div class="flex items-center justify-between px-3 py-[1px]">
        <div class="basis-0 flex-nowrap gap-x-2 grow overflow-hidden shrink-0 tabs">
          <a class="!border-b-primary min-w-0 tab tab-active tab-bordered tab-sm truncate uppercase">Terminal</a>
          <div
            class="hover:tooltip-open min-w-0 min-w-0 tooltip tooltip-top z-50"
            data-tip="Coming soon"
          >
            <a class="tab tab-sm truncate uppercase">Events</a>
          </div>
        </div>
        <div class="flex gap-x-1 items-center justify-center">
          <HandyButton
            class="btn-ghost btn-square btn-xs hover:bg-base-300"
            :on-click="async() => await webTermRef.newTab()"
          >
            <PlusIcon class="h-5 w-5" />
          </HandyButton>
          <button class="btn btn-ghost btn-square btn-xs hover:bg-base-300">
            <ChevronDownIcon
              class="h-5 w-5"
              @click="close"
            />
          </button>
        </div>
      </div>

      <WebTerm
        v-if="webTermShowed"
        ref="webTermRef"
        class="min-h-0"
      />
    </div>
  </div>
</template>

<style scoped>
</style>
