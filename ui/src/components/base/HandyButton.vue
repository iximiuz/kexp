<script lang="ts" setup>
import { ref } from "vue";

const props = defineProps<{
  onClick:() => Promise<void> | void,
}>();

const loading = ref(false);

const handleClick = async() => {
  if (loading.value) {
    return;
  }

  loading.value = true;
  try {
    await props.onClick();
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <button
    class="btn"
    @click.stop.prevent="handleClick"
  >
    <span
      v-if="loading"
      class="loading loading-ring loading-xs"
    />
    <slot v-else />
  </button>
</template>
