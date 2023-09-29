<script lang="ts" setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { onMounted, ref, watch } from "vue";

const props = defineProps<{
  store: {
    filterExpr: string | null;
    setFilterExpr:(f: string) => void;
    clearFilterExpr:() => void;
  };
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const filterExpr = ref<string>(props.store.filterExpr ?? "");

watch(() => filterExpr.value, (filterExpr) => {
  props.store.setFilterExpr(filterExpr);
});

onMounted(() => {
  watch(() => props.store.filterExpr, (filterExpr) => {
    if (filterExpr !== null && inputRef.value !== null) {
      inputRef.value.focus();
    }
  }, { immediate: true });
});
</script>

<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div
    class="duration-150 ease-in-out flex items-center my-1 px-[1.2rem] relative transition-all"
    :class="{
      'h-0 overflow-hidden': store.filterExpr === null,
      'h-[32px]': store.filterExpr !== null,
    }"
  >
    <input
      ref="inputRef"
      v-model="filterExpr"
      class="!rounded-sm focus:!outline-none input input-bordered input-sm pr-10 w-full"
      placeholder="dep,po,svc default/*"
      spellcheck="false"
    >
    <XMarkIcon
      class="absolute cursor-pointer h-[1rem] hover:opacity-100 opacity-50 right-7 text-primary-content"
      @click="store.clearFilterExpr()"
    />
  </div>
</template>

<style scoped>
</style>
