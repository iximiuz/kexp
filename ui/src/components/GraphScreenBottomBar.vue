<script setup>
import { QueueListIcon } from "@heroicons/vue/24/outline";
import { CommandLineIcon } from "@heroicons/vue/24/solid";

defineProps({
  toggleWebTerm: { type: Function, required: true },
});
</script>

<template>
  <div class="bg-base-200 border-neutral-content border-t flex gap-x-2 h-[1.6rem] items-center shrink-0">
    <span class="flex font-semibold h-full invisible items-center mr-32 px-6">
      Kubernetes Explorer
    </span>

    <div
      class="broder-box flex h-full hover:bg-base-300 hover:tooltip-open tooltip tooltip-top z-50"
      data-tip="Open web terminal"
    >
      <button
        class="btn btn-ghost btn-xs hover:shadow-none normal-case rounded-none"
        @click="toggleWebTerm"
      >
        <CommandLineIcon class="h-5 w-5" />
        <span class="font-normal text-[1rem] text-md">
          Terminal
        </span>
      </button>
    </div>

    <div
      class="broder-box flex h-full hover:bg-base-300 hover:tooltip-open tooltip tooltip-top z-50"
      data-tip="Watch cluster events - Coming soon!"
    >
      <button
        class="btn btn-ghost btn-xs hover:shadow-none normal-case rounded-none"
      >
        <QueueListIcon class="h-5 w-5" />
        <span class="font-normal text-[1rem] text-md">
          Events
        </span>
      </button>
    </div>

    <div
      class="broder-box flex h-full hover:bg-base-300 z-50"
    >
      <div class="dropdown dropdown-hover dropdown-top">
        <label
          tabindex="0"
          class="btn btn-ghost btn-xs flex-nowrap gap-1 hover:opacity-100 hover:shadow-none normal-case opacity-70 rounded-none shrink-0"
        >
          <div class="bg-[rgb(21,128,61)] border border-black h-4 rounded-sm w-4" />
          <div class="bg-[rgb(36,158,235)] border border-black h-4 rounded-sm w-4" />
          <div class="bg-[rgb(245,158,11)] border border-black h-4 rounded-sm w-4" />
          <div class="bg-[rgb(239,68,68)] border border-black h-4 rounded-sm w-4" />
        </label>
        <ul
          tabindex="0"
          class="-left-[18rem] bg-base-200 border border-neutral-content dropdown-content flex flex-col gap-y-1 md:-left-[15rem] px-4 py-3 rounded-md shadow-lg w-[25rem] z-[50]"
        >
          <h2 class="font-semibold mb-3 text-base">
            Color coding of graph objects
          </h2>

          <li class="flex items-center text-sm">
            <div class="bg-[rgb(21,128,61)] border border-black h-4 rounded-sm w-4" />&nbsp;- Recently created
          </li>
          <li class="flex items-center text-sm">
            <div class="bg-[rgb(36,158,235)] border border-black h-4 rounded-sm w-4" />&nbsp;- No change for last ~5 sec
          </li>
          <li class="flex items-center text-sm">
            <div class="bg-[rgb(245,158,11)] border border-black h-4 rounded-sm w-4" />&nbsp;- Recently updated
          </li>
          <li class="flex items-center text-sm">
            <div class="bg-[rgb(239,68,68)] border border-black h-4 rounded-sm w-4" />&nbsp;- Deletion timestamp is set
          </li>

          <p class="mt-3 text-sm">
            Objects are removed from the graph ~5 sec after they disappear from the API response.
          </p>
        </ul>
      </div>
    </div>

    <div class="ml-auto mr-2">
      <a
        target="_blank"
        href="https://github.com/iximiuz/kexp"
        class="h-5 w-5"
      >
        <img
          src="/logos/github.png"
          alt="GitHub project page"
          class="h-5 w-5"
        >
      </a>
    </div>
  </div>
</template>

<style scoped>
</style>
