<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/editor/store'
import { actions, kbds } from '@/editor/shortcuts'

const groups = computed(() =>
  (['Tools', 'Edit', 'View', 'Floors'] as const).map(g => ({
    id: g,
    label: g,
    items: actions
      .filter(a => a.group === g && a.id !== 'palette' && a.id !== 'escape')
      .map(a => ({
        label: a.label,
        icon: a.icon,
        kbds: a.keys?.[0] ? kbds(a.keys[0]) : undefined,
        disabled: a.enabled ? !a.enabled() : false,
        onSelect: () => {
          store.ui.palette = false
          a.run()
        }
      }))
  }))
)
</script>

<template>
  <UModal v-model:open="store.ui.palette" :ui="{ content: 'p-0' }">
    <template #content>
      <UCommandPalette :groups="groups" placeholder="Search actions…" class="h-96" @update:open="(o: boolean) => (store.ui.palette = o)" />
    </template>
  </UModal>
</template>
