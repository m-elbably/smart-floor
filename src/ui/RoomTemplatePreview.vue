<script setup lang="ts">
import { computed } from 'vue'
import type { RoomTemplate } from '@/editor/presets'
import { bbox } from '@/editor/geometry'
import { itemFootprint } from '@/catalog'

const props = defineProps<{
  template: RoomTemplate
}>()

const bounds = computed(() => {
  const b = bbox(props.template.polygon)
  const pad = 0.5
  const w = Math.max(b.max[0] - b.min[0], 0.5)
  const d = Math.max(b.max[1] - b.min[1], 0.5)
  const maxDim = Math.max(w, d) + 2 * pad
  const cx = (b.min[0] + b.max[0]) / 2
  const cy = (b.min[1] + b.max[1]) / 2
  return {
    viewBox: `${cx - maxDim / 2} ${-cy - maxDim / 2} ${maxDim} ${maxDim}`
  }
})

const polyPoints = computed(() =>
  props.template.polygon.map(([x, y]) => `${x},${-y}`).join(' ')
)

const itemFootprints = computed(() =>
  (props.template.items ?? []).map(i => {
    const fp = itemFootprint({
      catalogId: i.catalogId,
      x: i.at[0],
      y: i.at[1],
      rotation: i.rotation,
      scale: i.scale ?? [1, 1, 1]
    })
    return fp.map(([x, y]) => `${x},${-y}`).join(' ')
  })
)
</script>

<template>
  <div class="relative w-full aspect-4/3 rounded-lg bg-elevated/40 border border-default/60 overflow-hidden flex items-center justify-center p-2">
    <svg
      :viewBox="bounds.viewBox"
      class="w-full h-full max-h-40 select-none overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Room Floor & Walls -->
      <polygon
        :points="polyPoints"
        class="fill-primary/10 stroke-primary/80 dark:stroke-primary/70 transition-colors"
        stroke-width="0.12"
        stroke-linejoin="round"
      />

      <!-- Furniture Items -->
      <polygon
        v-for="(fp, idx) in itemFootprints"
        :key="idx"
        :points="fp"
        class="fill-neutral-500/25 stroke-neutral-600/80 dark:stroke-neutral-300/80"
        stroke-width="0.04"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
