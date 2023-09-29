<script lang="ts" setup>
import { EllipsisVerticalIcon } from "@heroicons/vue/24/outline";

defineProps<{
  store: {
    setFilterExpr:(f: string) => void;
  };
}>();
</script>

<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div
    class="dropdown flex"
    @click.stop.prevent="() => {}"
  >
    <label
      tabindex="0"
      class="btn btn-ghost btn-square btn-xs h-[18px] min-h-[18px] rounded-md w-[18px]"
    >
      <EllipsisVerticalIcon class="h-4 w-4" />
    </label>
    <ul
      tabindex="0"
      class="bg-base-200 border border-primary-content/40 dropdown-content max-w-[280px] menu menu-sm p-0 rounded-md shadow-primary-content shadow-xs z-[80]"
    >
      <li
        @click="store.setFilterExpr('')"
      >
        <a class="flex items-center rounded-none text-sm truncate">
          Filter resources <span class="ml-4"><kbd class="kbd kbd-sm">⌘</kbd><kbd class="kbd kbd-sm">f</kbd></span>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>
