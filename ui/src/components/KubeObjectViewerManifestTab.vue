<script lang="ts" setup>
import { ClipboardIcon } from "@heroicons/vue/24/outline";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/24/solid";
import { useClipboard } from "@vueuse/core";
import { computed, reactive, ref } from "vue";

import { reprJson, reprYaml, reprYamlLastApplied, reprJsonStatusOnly, reprYamlStatusOnly } from "../common/repr";

import type { KubeObject } from "../common/types";

import CodeEditor from "./CodeEditor.vue";

const props = defineProps<{
  object: KubeObject,
}>();

const format = ref("yaml" as "yaml" | "json");
const active = ref("Full Manifest");

const menuItems = computed(() => {
  const items = reactive([
    {
      name: "Full Manifest",
      onClick: (): void => {
        active.value = "Full Manifest";
      },
      code: () => {
        return format.value === "json"
          ? reprJson(props.object)
          : reprYaml(props.object);
      },
      icon: () => {
        return active.value === "Full Manifest" ? CheckIcon : undefined;
      },
      divided: false,
    },
    {
      name: "Status Only",
      onClick: (): void => {
        active.value = "Status Only";
      },
      icon: () => {
        return active.value === "Status Only" ? CheckIcon : undefined;
      },
      code: () => {
        return format.value === "json"
          ? reprJsonStatusOnly(props.object)
          : reprYamlStatusOnly(props.object);
      },
    },
    {
      name: "As YAML",
      onClick: (): void => {
        format.value = "yaml";
      },
      icon: () => {
        return format.value === "yaml" ? CheckIcon : undefined;
      },
      disabled: () => {
        return active.value === "Last Applied";
      },
      divided: true,
    },
    {
      name: "As JSON",
      icon: () => {
        return format.value === "json" ? CheckIcon : undefined;
      },
      onClick: (): void => {
        format.value = "json";
      },
      disabled: () => {
        return active.value === "Last Applied";
      },
    },
  ]);

  if (reprYamlLastApplied(props.object)) {
    items.unshift({
      name: "Last Applied",
      onClick: () => {
        active.value = "Last Applied";
      },
      icon: () => {
        return active.value === "Last Applied" ? CheckIcon : undefined;
      },
      code: () => {
        return reprYamlLastApplied(props.object)!;
      },
    });
  }

  return items;
});

const activeItem = computed(() => {
  return menuItems.value.find((i) => i.name === active.value) || menuItems.value[0];
});

const clipboardIcon = ref(ClipboardIcon);

async function onCopyClick() {
  if (!activeItem.value.code) {
    return;
  }

  await useClipboard().copy(activeItem.value.code());

  clipboardIcon.value = CheckIcon;

  setTimeout(() => {
    clipboardIcon.value = ClipboardIcon;
  }, 2000);
}
</script>

<template>
  <div class="overflow-hidden relative">
    <div
      v-if="object.isFreshlyCreated || object.isFreshlyUpdated"
      class="absolute animate-pulse font-bold leading-[0.8rem] left-0 right-0 text-[0.6rem] text-center text-white top-0 tracking-wider uppercase z-30"
      :class="{
        'bg-green-700 border-green-700': object.isFreshlyCreated,
        'bg-amber-500 border-amber-500': object.isFreshlyUpdated,
      }"
    >
      {{ object.isFreshlyCreated ? "Created" : "Updated" }}
    </div>
    <div class="absolute dropdown dropdown-end right-2 top-2 z-30">
      <label
        tabindex="0"
        class="border btn btn-xs font-normal normal-case rounded-md text-sm"
      >
        {{ activeItem.name }} <ChevronUpDownIcon class="-mr-1 h-[1.25em]" />
      </label>
      <ul
        tabindex="0"
        class="bg-base-200 border border-primary-content/40 dropdown-content max-w-[280px] menu menu-xs min-w-[20ch] mt-1 px-0 rounded-md z-40"
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
              class="flex items-center leading-[1.4rem] pl-3 rounded-none text-sm truncate"
              :class="{
                'opacity-50 pointer-events-none': item.disabled && item.disabled(),
              }"
              @click="!(item.disabled && item.disabled()) && item.onClick()"
            >
              {{ item.name }}
              <component
                :is="item.icon()"
                class="cursor-pointer h-[1.25em] hover:text-error ml-auto w-[1.2em]"
              />
            </a>
          </li>
        </template>
      </ul>
    </div>

    <CodeEditor
      :key="object.rev"
      :code="activeItem.code && activeItem.code()"
    />

    <button
      class="absolute bg-transparent border-none bottom-[0.7rem] btn btn-square btn-xs hover:bg-transparent hover:opacity-100 opacity-50 right-[0.5rem] text-base-100 z-40"
      @click="onCopyClick"
    >
      <component
        :is="clipboardIcon"
        class="w-[1.4rem]"
      />
    </button>
  </div>
</template>

<style scoped>
</style>
