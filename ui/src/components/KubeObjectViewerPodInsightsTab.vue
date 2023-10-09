<script lang="ts" setup>
import { computed } from "vue";

import { podPhaseClass, reprTimeRelative, reprPodPhase } from "../common/repr";
import type { KubeObject, V1Pod } from "../common/types";

import KubeObjectViewerPodConditions from "./KubeObjectViewerPodConditions.vue";
import KubeObjectViewerPodContainers from "./KubeObjectViewerPodContainers.vue";

const props = defineProps<{
  object: KubeObject<V1Pod>,
  tab: {
    name: string,
  },
}>();

const phase = computed(() => reprPodPhase(props.object.raw));
</script>

<template>
  <div class="overflow-auto scrollbar-styled">
    <div class="divide-y flex flex-col gap-y-8 p-4">
      <div
        :key="object.rev"
        class="grid grid-cols-2"
      >
        <div>Phase:</div>
        <div
          class="flex font-semibold gap-x-2 items-center"
        >
          <span
            class="border border-black h-[0.7rem] rounded-full w-[0.7rem]"
            :class="['bg-' + podPhaseClass[phase.phase]]"
          />
          {{ phase.title }}
        </div>
        <div>Started:</div>
        <div :title="object.raw.status!.startTime + ''">
          {{ reprTimeRelative(object.raw.status!.startTime + '') }} ago
        </div>
        <div>IPs:</div>
        <div>{{ object.raw.status!.podIPs?.map((el) => el.ip)?.join(" ") }}</div>
      </div>

      <div>
        <h2 class="font-semibold mb-1 mt-4 text-lg text-slate-600">
          Containers
        </h2>

        <KubeObjectViewerPodContainers
          :object="object"
        />

        <div class="max-w-[35ch] mt-2">
          <span class="text-slate-600">Legend</span>
          <div class="grid grid-cols-2 justify-start leading-[1.6rem] mt-2">
            <div class="border border-black container-waiting h-[1.4rem] rounded-md w-[4rem]" />
            <div class="">
              Waiting
            </div>
            <div class="border border-black container-starting h-[1.4rem] rounded-md w-[4rem]" />
            <div class="">
              Starting
            </div>
            <div class="border border-black container-ready h-[1.4rem] rounded-md w-[4rem]" />
            <div class="">
              Running (Ready)
            </div>
            <div class="border border-black container-not-ready h-[1.4rem] rounded-md w-[4rem]" />
            <div class="">
              Running (Not Ready)
            </div>
            <div class="border border-black container-terminated-ok h-[1.4rem] rounded-md w-[4rem]" />
            <div class="">
              Terminated OK
            </div>
            <div class="border border-black container-terminated-ko h-[1.4rem] rounded-md w-[4rem]" />
            <div class="">
              Terminated KO
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 class="font-semibold mb-1 mt-4 text-lg text-slate-600">
          Conditions
        </h2>
        <KubeObjectViewerPodConditions :object="object" />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
