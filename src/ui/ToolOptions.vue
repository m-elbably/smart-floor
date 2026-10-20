<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@/editor/store'
import { DOOR_PRESETS, WINDOW_PRESETS, ZONE_KINDS } from '@/editor/presets'
import { getTemplate } from '@/editor/templates'
import { cancelTool } from '@/editor/tools'

const currentTemplate = computed(() => getTemplate(store.toolOptions.template))

const opts = computed(() => {
  const t = store.tool
  if (t === 'door') return { key: 'door' as const, items: Object.entries(DOOR_PRESETS).map(([value, p]) => ({ value, label: p.label })) }
  if (t === 'zone') return { key: 'zone' as const, items: Object.entries(ZONE_KINDS).map(([value, z]) => ({ value, label: z.label, icon: z.icon })) }
  if (t === 'wall')
    return {
      key: 'wall' as const,
      items: [
        { value: 'wall', label: 'Wall', icon: 'i-lucide-brick-wall' },
        { value: 'fence', label: 'Fence', icon: 'i-lucide-fence' }
      ]
    }
  if (t === 'stair')
    return {
      key: 'stair' as const,
      items: [
        { value: 'straight', label: 'Straight' },
        { value: 'L', label: 'L-shaped (landing)' },
        { value: 'U', label: 'U-shaped (landing)' },
        { value: 'spiral', label: 'Spiral' }
      ]
    }
  if (t === 'window') return { key: 'window' as const, items: Object.entries(WINDOW_PRESETS).map(([value, p]) => ({ value, label: p.label })) }
  return null
})
</script>

<template>
  <div v-if="store.tool === 'template'" class="flex items-center gap-1.5">
    <UButton
      :icon="currentTemplate.icon || 'i-lucide-stamp'"
      :label="currentTemplate.label"
      trailing-icon="i-lucide-layout-grid"
      color="neutral"
      variant="outline"
      size="sm"
      class="bg-default/90 backdrop-blur shadow-sm max-w-60 truncate font-medium"
      aria-label="Room templates"
      @click="store.ui.templates = true"
    />
  </div>
  <USelect
    v-else-if="opts"
    :model-value="store.toolOptions[opts.key]"
    :items="opts.items"
    class="w-56"
    aria-label="Preset"
    @update:model-value="(v: unknown) => ((store.toolOptions[opts!.key] = v as string), cancelTool())"
  />
</template>
