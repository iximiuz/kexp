<script lang="ts" setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { ref } from "vue";

import { useAppStore } from "../stores";

defineExpose({
  newTab,
});

interface Tab {
  name: string;
  url: string;
  active: boolean;
}

const tabs = ref([] as Tab[]);

async function newTab() {
  const maxTermNumber = tabs.value.reduce((max, tab) => {
    const match = tab.name.match(/Term (\d+)/);
    if (match) {
      return Math.max(max, parseInt(match[1]));
    } else {
      return max;
    }
  }, 0);

  tabs.value.push({
    name: "Term " + (maxTermNumber + 1),
    url: await useAppStore().requestWebTerm(),
    active: false,
  });
  selectTab(tabs.value[tabs.value.length - 1]);
}

function selectTab(tab: Tab) {
  tabs.value.forEach((t) => { t.active = false; });
  tab.active = true;
}

function closeTab(tab: Tab) {
  const index = tabs.value.indexOf(tab);
  if (index >= 0) {
    if (tab.active) {
      if (index > 0) {
        selectTab(tabs.value[index - 1]);
      } else if (index < tabs.value.length - 1) {
        selectTab(tabs.value[index + 1]);
      }
    }
    tabs.value.splice(index, 1);
  }
}

newTab();
</script>

<template>
  <div class="divide-x flex gap-x-1 grow self-stretch">
    <div class="bg-[rgb(34,34,34)] grow overflow-hidden">
      <iframe
        v-for="tab in tabs"
        v-show="tab.active"
        :key="tab.name"
        :src="tab.url"
        class="h-full w-full"
        allow="clipboard-read *; clipboard-write *;"
      />
    </div>

    <ul
      v-if="tabs.length > 1"
      class="select-none shrink-0"
    >
      <li
        v-for="tab in tabs"
        :key="tab.name"
        class="border-x-[2px] border-x-transparent cursor-pointer flex gap-x-1 items-center justify-between leading-[1.8rem] pl-2"
        :class="{
          'border-l-primary bg-primary/20': tab.active,
          'hover:bg-primary/10': !tab.active,
        }"
        @click="selectTab(tab)"
      >
        {{ tab.name }}
        <div class="hover:bg-primary/20 p-1 rounded-md">
          <XMarkIcon
            class="h-4 w-4"
            @click.stop="closeTab(tab)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>
