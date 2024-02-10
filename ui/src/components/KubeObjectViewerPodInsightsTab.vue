<script lang="ts" setup>
import { computed, ref } from "vue";

import { podPhaseClass, reprTimeRelative, reprPodPhase, reprYamlRaw } from "../common/repr";
import type { KubeObject, V1Container, V1Pod } from "../common/types";

import CodeEditor from "./CodeEditor.vue";
import KubeObjectViewerPodConditions from "./KubeObjectViewerPodConditions.vue";
import KubeObjectViewerPodContainers from "./KubeObjectViewerPodContainers.vue";

const props = defineProps<{
  object: KubeObject<V1Pod>,
  tab: {
    name: string,
  },
}>();

const phase = computed(() => reprPodPhase(props.object.raw));

const selectedContainer = ref<V1Container | null>(null);

const selectedContainerYaml = computed(() => {
  if (!selectedContainer.value) {
    return "";
  }

  const statuses = [
    ...(props.object.raw.status!.initContainerStatuses! || []),
    ...(props.object.raw.status!.containerStatuses! || []),
    ...(props.object.raw.status!.ephemeralContainerStatuses! || []),
  ];

  return reprYamlRaw({
    spec: selectedContainer.value,
    status: statuses.find((s) => s.name === selectedContainer.value!.name),
  });
});
</script>

<template>
  <div
    class="overflow-auto scrollbar-styled"
    @click="selectedContainer = null"
  >
    <div class="divide-y flex flex-col gap-y-8 p-4">
      <div
        :key="object.rev"
        class="grid grid-cols-2"
      >
        <div class="cursor-default">
          Phase:
        </div>
        <div
          class="flex font-semibold gap-x-2 items-center"
        >
          <span
            class="border border-black h-[0.7rem] rounded-full w-[0.7rem]"
            :class="['bg-' + podPhaseClass[phase.phase]]"
          />
          {{ phase.title }}
        </div>
        <div class="cursor-default">
          Started:
        </div>
        <div :title="object.raw.status!.startTime + ''">
          {{ reprTimeRelative(object.raw.status!.startTime + '') }} ago
        </div>
        <div class="cursor-default">
          IPs:
        </div>
        <div>{{ object.raw.status!.podIPs?.map((el) => el.ip)?.join(" ") }}</div>
      </div>

      <div>
        <h2 class="cursor-default font-semibold mb-1 mt-4 text-lg text-slate-600">
          Containers
        </h2>

        <KubeObjectViewerPodContainers
          :object="object"
          :on-container-click="(c: any) => selectedContainer = c"
        />

        <div
          class="duration-150 ease-in-out mt-2 overflow-hidden rounded-md transition-all"
          :class="{
            'h-0': !selectedContainerYaml,
            'h-[200px]': selectedContainerYaml,
          }"
        >
          <CodeEditor
            v-if="selectedContainerYaml"
            :key="object.rev"
            :code="selectedContainerYaml"
          />
        </div>

        <div class="cursor-default max-w-[35ch] mt-2">
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
        <h2 class="cursor-default font-semibold mb-1 mt-4 text-lg text-slate-600">
          Conditions
        </h2>
        <KubeObjectViewerPodConditions :object="object" />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
