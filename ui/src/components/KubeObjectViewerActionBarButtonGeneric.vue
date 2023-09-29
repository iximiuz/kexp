<script lang="ts" setup>
import type { Component } from "vue";

import HandyButton from "./base/HandyButton.vue";

defineProps<{
  action: {
    name: string;
    disabled?:() => boolean;
    available?: () => boolean;
    onClick: () => void;
    icon: Component,
    extraClassWrapper?: string[];
    extraClassIcon?: string[];
  };
}>();
</script>

<template>
  <div
    class="tooltip tooltip-left"
    :data-tip="action.name"
    :class="action.extraClassWrapper"
  >
    <HandyButton
      class="btn-outline btn-sm btn-square"
      :disabled="action.disabled && action.disabled()"
      :on-click="action.onClick"
    >
      <component
        :is="action.icon"
        class="h-5 w-5"
        :class="action.extraClassIcon"
      />
    </HandyButton>
  </div>
</template>

<style scoped>
</style>
