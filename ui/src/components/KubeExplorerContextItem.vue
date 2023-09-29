<script setup>
import KubeExplorerExpandableItem from "./KubeExplorerExpandableItem.vue";
import KubeExplorerResourceGroupItem from "./KubeExplorerResourceGroupItem.vue";
import SimpleLoader from "./base/SimpleLoader.vue";

defineProps({
  context: { type: Object, required: true },
  store: { type: Object, required: true },
});
</script>

<template>
  <KubeExplorerExpandableItem
    :toggle="() => store.toggleContext(context)"
    :is-open="store.isContextOpen(context)"
  >
    <template #title>
      <span
        :title="context.name"
        class="truncate"
      >
        context&nbsp;<span class="font-semibold text-info">{{ context.name }}</span>
      </span>
    </template>

    <SimpleLoader
      :load="() => store.loadResources(context)"
      loading-class="ml-4"
      error-class="ml-4"
    >
      <ul
        class="border-l border-neutral-content/40"
      >
        <li
          v-for="rg in store.resourceGroups(context)"
          :key="rg.groupVersion"
        >
          <KubeExplorerResourceGroupItem
            :context="context"
            :group="rg"
            :store="store"
          />
        </li>
      </ul>
    </SimpleLoader>
  </KubeExplorerExpandableItem>
</template>

<style scoped>
</style>
