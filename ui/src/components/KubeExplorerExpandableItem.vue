<script setup>
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/vue/24/outline";

defineProps({
  toggle: { type: Function, required: true },
  isOpen: { type: Boolean, required: true },
  locked: { type: Boolean, default: false },
  highlightable: { type: Boolean, default: false },
  scrollable: { type: Boolean, default: false },
});
</script>

<template>
  <div
    class="flex flex-col"
  >
    <div
      :class="{
        'border-b border-b-base-300 shadow-sm': isOpen && scrollable,
      }"
    >
      <div
        class="cursor-pointer flex items-center min-w-0 pr-[1.2rem]"
        :class="{
          'hover:bg-primary/10': highlightable,
          'bg-primary/10': highlightable && locked,
        }"
        @click="toggle"
      >
        <ChevronDownIcon
          v-if="isOpen"
          class="h-[1rem] mx-[0.1rem] shrink-0 w-[1rem]"
          :class="{
            'invisible': locked,
          }"
        />
        <ChevronRightIcon
          v-else
          class="h-[1rem] mx-[0.1rem] shrink-0 w-[1rem]"
          :class="{
            'invisible': locked,
          }"
        />
        <slot name="title" />
      </div>

      <slot name="subtitle" />
    </div>

    <div
      v-if="isOpen"
      class="min-h-0 overflow-y-auto pl-[0.55rem] scrollbar-styled"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
</style>
