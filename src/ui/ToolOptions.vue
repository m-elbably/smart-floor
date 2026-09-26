<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/editor/store'
import { TEMPLATES, DOOR_PRESETS, WINDOW_PRESETS } from '@/editor/presets'
import { cancelTool } from '@/editor/tools'

const opts = computed(() => {
  const t = store.tool
  if (t === 'template') return { key: 'template' as const, items: Object.entries(TEMPLATES).map(([value, p]) => ({ value, label: p.label, icon: p.icon })) }
  if (t === 'door') return { key: 'door' as const, items: Object.entries(DOOR_PRESETS).map(([value, p]) => ({ value, label: p.label })) }
  if (t === 'window') return { key: 'window' as const, items: Object.entries(WINDOW_PRESETS).map(([value, p]) => ({ value, label: p.label })) }
  return null
})
</script>

<template>
  <USelect
    v-if="opts"
    :model-value="store.toolOptions[opts.key]"
    :items="opts.items"
    class="w-56"
    aria-label="Preset"
    @update:model-value="(v: unknown) => ((store.toolOptions[opts!.key] = v as string), cancelTool())"
  />
</template>
