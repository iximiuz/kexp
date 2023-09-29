<script setup>
import { DocumentDuplicateIcon, EyeIcon, WrenchScrewdriverIcon } from "@heroicons/vue/24/outline";
import { computed, onMounted, reactive, ref, watch } from "vue";

import { useAppStore } from "../stores";

import KubeExplorer from "./KubeExplorer.vue";
import KubeWatch from "./KubeWatch.vue";

const containerRef = ref(null);
const hResizerRef = ref(null);
const hResizing = ref(false);

const navbarWidth = 50;
const drawerMinWidth = 200;

// 210px is enough to fit most of the Kubernetes resource names in the explorer.
const width = ref(navbarWidth + 210);

const sections = reactive({
  explorer: {
    open: true,
    tooltip: "Resource explorer",
    icon: DocumentDuplicateIcon,
  },
  watches: {
    open: false,
    tooltip: "Resource watching (coming soon)",
    icon: EyeIcon,
  },
  requestBuilder: {
    open: false,
    tooltip: "Request builder (coming soon)",
    icon: WrenchScrewdriverIcon,
  },
});

const drawerOpen = computed(() => Object.values(sections).some((s) => s.open));

watch(drawerOpen, (open) => {
  if (open) {
    containerRef.value.style.flexBasis = width.value + "px";
  } else {
    containerRef.value.style.flexBasis = navbarWidth + "px";
  }
});

function closeAllSections() {
  Object.values(sections).forEach((s) => {
    s.lastOpen = s.open;
    s.open = false;
  });
}

function toggleSection(section) {
  if (section.open) {
    section.lastOpen = true;
    section.open = false;
  } else {
    closeAllSections();
    section.open = true;
  }
}

function findLastOpenSection() {
  return Object.values(sections).find((s) => s.lastOpen) || sections.explorer;
}

watch(() => useAppStore().requestBuilder, (requestBuilder) => {
  if (requestBuilder && !sections.requestBuilder.open) {
    toggleSection(sections.requestBuilder);
  }
});

onMounted(() => {
  containerRef.value.style.flexBasis = width.value + "px";

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
      width.value = originalSize + (mousePosition - originalMousePosition);

      if (width.value < drawerMinWidth / 2) {
        closeAllSections();
      } else if (!drawerOpen.value && width.value > drawerMinWidth / 2) {
        toggleSection(findLastOpenSection());
      } else {
        containerRef.value.style["flex-basis"] = width.value + "px";
      }
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
    class="bg-base-200 border-neutral-content border-r flex h-full relative"
    :class="{
      'transition-all duration-150 ease-in-out': !hResizing,
    }"
    :style="{
      'min-width': navbarWidth + (drawerOpen ? drawerMinWidth : 0) + 'px',
    }"
  >
    <div
      class="border-box border-neutral-content border-r flex flex-col gap-y-2 h-full items-stretch shrink-0"
      :style="{
        'min-width': navbarWidth + 'px',
      }"
    >
      <div
        v-for="(section, name) in sections"
        :key="name"
        class="border-x-[3px] border-x-transparent hover:tooltip-open py-1 tooltip tooltip-right z-50"
        :class="{
          'border-l-primary': section.open,
        }"
        :data-tip="section.tooltip"
      >
        <button
          class="btn btn-ghost btn-square group hover:bg-transparent"
        >
          <component
            :is="section.icon"
            class="duration-150 ease-in-out group-hover:text-base-content h-[30px] text-base-content/75 transition-colors w-[30px]"
            @click="toggleSection(section)"
          />
        </button>
      </div>
    </div>

    <div
      v-show="drawerOpen"
      class="flex grow h-full min-h-0"
      :style="{
        'min-width': drawerMinWidth + 'px',
      }"
    >
      <KubeExplorer
        v-show="sections.explorer.open"
        class="grow min-w-0"
      />
      <KubeWatch
        v-show="sections.watches.open"
        class="grow min-w-0"
      />
      <div
        v-show="sections.requestBuilder.open"
        class="flex grow items-center justify-center"
      >
        Coming soon...
      </div>
    </div>

    <div
      ref="hResizerRef"
      class="-right-[2px] absolute bottom-0 delay-300 top-0 w-[4px] z-40"
      :class="{
        'cursor-col-resize bg-primary': hResizing,
        'hover:bg-primary': !hResizing,
        'hover:cursor-col-resize': drawerOpen,
        'hover:cursor-e-resize': !drawerOpen,
      }"
    />
  </div>
</template>

<style scoped>
</style>
