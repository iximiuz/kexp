<script setup>
import KubeExplorerExpandableItem from "./KubeExplorerExpandableItem.vue";
import KubeExplorerResourceItem from "./KubeExplorerResourceItem.vue";

defineProps({
  context: { type: Object, required: true },
  group: { type: Object, required: true },
  store: { type: Object, required: true },
});
</script>

<template>
  <KubeExplorerExpandableItem
    :toggle="() => store.toggleResourceGroup(context, group)"
    :highlightable="true"
    :is-open="store.isResourceGroupOpen(context, group)"
  >
    <template #title>
      <span
        :title="group.groupVersion"
        class="truncate"
        :class="{ 'font-semibold': store.$id === 'quickExplorerStore' }"
      >
        {{ group.groupVersion }}
      </span>
    </template>

    <ul
      class="border-l border-neutral-content/40"
    >
      <p
        v-if="store.resources(context, group).length === 0"
        class="block cursor-default font-light opacity-70 pl-4"
      >
        (empty)
      </p>
      <template v-else>
        <li
          v-for="res in store.resources(context, group)"
          :key="res.name"
        >
          <KubeExplorerResourceItem
            :context="context"
            :resource="res"
            :store="store"
          />
        </li>
      </template>
    </ul>
  </KubeExplorerExpandableItem>
</template>

<style scoped>
</style>
