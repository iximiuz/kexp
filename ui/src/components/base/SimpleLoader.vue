<script lang="ts" setup>
import { ref } from "vue";

const props = defineProps({
  load: { type: Function, required: true },
  loadingClass: { type: String, default: "" },
  errorClass: { type: String, default: "" },
});

const loading = ref(true);
const error = ref(null as Error | null);

const safeLoad = () => {
  loading.value = true;
  error.value = null;

  props.load().then(
    () => { loading.value = false; },
    (err: Error) => {
      loading.value = false;
      error.value = err;
      console.debug("Loading failed", err);
    },
  );
};

safeLoad();
</script>

<template>
  <slot
    v-if="loading"
    name="loading"
  >
    <div
      class="animate-pulse"
      :class="loadingClass"
    >
      Loading...
    </div>
  </slot>
  <slot
    v-if="error"
    name="failed"
  >
    <div
      class="text-error"
      :class="errorClass"
    >
      Loading failed: "{{ error.message || error }}"&nbsp;<a
        href="javascript: void 0"
        class="animate-pulse text-primary underline"
        @click="safeLoad"
      >Retry</a>
    </div>
  </slot>
  <slot v-if="!loading && !error" />
</template>
