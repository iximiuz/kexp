<script lang="ts" setup>
import { ClipboardIcon, CheckIcon } from "@heroicons/vue/24/outline";
import { useClipboard } from "@vueuse/core";
import { ref } from "vue";

const props = defineProps<{
  text: string,
  copyText?: string,
}>();

const clipboardIcon = ref(ClipboardIcon);

async function onCopyClick() {
  await useClipboard().copy(props.copyText || props.text);

  clipboardIcon.value = CheckIcon;

  setTimeout(() => {
    clipboardIcon.value = ClipboardIcon;
  }, 2000);
}
</script>

<template>
  <div class="flex group items-center">
    <slot>
      {{ text }}
    </slot>

    <button
      class="bg-transparent border-none btn btn-square btn-xs group-hover:flex group-hover:opacity-50 hidden hover:!opacity-100 hover:bg-transparent z-40"
      @click="onCopyClick"
    >
      <component
        :is="clipboardIcon"
        class="w-[1rem]"
      />
    </button>
  </div>
</template>
