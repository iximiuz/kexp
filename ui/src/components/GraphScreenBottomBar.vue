<script setup>
import { QueueListIcon } from "@heroicons/vue/24/outline";
import { CommandLineIcon } from "@heroicons/vue/24/solid";

defineProps({
  toggleWebTerm: { type: Function, required: true },
});
</script>

<template>
  <div class="bg-base-200 border-neutral-content border-t flex gap-x-2 h-[1.6rem] items-center shrink-0">
    <span class="flex font-semibold h-full invisible items-center mr-40 px-6">
      Kubernetes Explorer
    </span>
    <div
      class="broder-box flex h-full hover:bg-base-300 hover:tooltip-open tooltip tooltip-top z-50"
      data-tip="Open web terminal"
    >
      <button
        class="btn btn-ghost btn-xs hover:shadow-none normal-case rounded-none"
        @click="toggleWebTerm"
      >
        <CommandLineIcon class="h-5 w-5" />
        <span class="font-normal text-[1rem] text-md">
          Terminal
        </span>
      </button>
    </div>
    <div
      class="broder-box flex h-full hover:bg-base-300 hover:tooltip-open tooltip tooltip-top z-50"
      data-tip="Watch cluster events - Coming soon!"
    >
      <button
        class="btn btn-ghost btn-xs hover:shadow-none normal-case rounded-none"
      >
        <QueueListIcon class="h-5 w-5" />
        <span class="font-normal text-[1rem] text-md">
          Events
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
</style>
