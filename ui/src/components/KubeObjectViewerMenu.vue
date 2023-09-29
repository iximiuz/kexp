<script lang="ts" setup>
import { BeakerIcon, EllipsisVerticalIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { computed } from "vue";

import type { KubeObject } from "../common/types";
import { useAppStore } from "../stores";

defineProps<{
  object: KubeObject,
}>();

const appStore = useAppStore();

const allMenuItems = [
  {
    name: "More actions to come...",
    onClick: () => {},
    icon: BeakerIcon,
    disabled: () => false,
  },
  {
    name: "Close pane",
    divided: true,
    onClick: () => {
      appStore.setInspectedKubeObject(null);
    },
    icon: XMarkIcon,
    disabled: () => false,
  },
];

const menuItems = computed(() => {
  return allMenuItems.filter((item) => !item.disabled || !item.disabled());
});
</script>

<template>
  <div class="dropdown dropdown-end">
    <label
      tabindex="0"
      class="btn btn-ghost btn-sm btn-square rounded-md"
    >
      <EllipsisVerticalIcon class="h-6 w-6" />
    </label>
    <ul
      tabindex="0"
      class="bg-base-200 border border-primary-content/40 dropdown-content max-w-[280px] menu menu-sm mr-4 px-0 py-2 rounded-md shadow-lg shadow-primary-content z-40"
    >
      <template
        v-for="(item, idx) in menuItems"
        :key="item.name"
      >
        <div
          v-if="item.divided && idx !== 0"
          class="divider my-1"
        />
        <li>
          <a
            class="flex items-center leading-[1.8rem] rounded-none text-[1rem] truncate"
            @click="item.onClick"
          >
            <component
              :is="item.icon"
              class="cursor-pointer h-[1.25em] hover:text-error w-[1.2em]"
            />
            {{ item.name }}
          </a>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
</style>
