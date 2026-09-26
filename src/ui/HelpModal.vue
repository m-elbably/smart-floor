<script setup lang="ts">
import { store } from '@/editor/store'
import { actions, kbds } from '@/editor/shortcuts'

const groups = ['Tools', 'Edit', 'View', 'Floors'] as const
const extra = [
  { label: 'Pan', keys: ['Middle drag', 'Space + drag', 'Arrows'] },
  { label: 'Zoom to cursor', keys: ['Wheel'] },
  { label: 'Orbit (3D)', keys: ['Left drag'] },
  { label: 'No snapping', keys: ['Alt'] },
  { label: 'Rotate template', keys: ['R'] },
  { label: 'Flip door', keys: ['F'] },
  { label: 'Type a length while drawing', keys: ['3.5', '350cm', '4x3'] }
]
</script>

<template>
  <UModal v-model:open="store.ui.help" title="Keyboard shortcuts" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
        <section v-for="g in groups" :key="g">
          <h3 class="font-semibold mb-1.5 text-highlighted">{{ g }}</h3>
          <div v-for="a in actions.filter(a => a.group === g && a.keys)" :key="a.id" class="flex items-center justify-between py-0.5">
            <span class="text-muted">{{ a.label }}</span>
            <span class="flex gap-0.5"><UKbd v-for="k in kbds(a.keys![0])" :key="k" :value="k" /></span>
          </div>
        </section>
        <section>
          <h3 class="font-semibold mb-1.5 text-highlighted">Mouse &amp; drawing</h3>
          <div v-for="x in extra" :key="x.label" class="flex items-center justify-between py-0.5">
            <span class="text-muted">{{ x.label }}</span>
            <span class="flex gap-1"><UKbd v-for="k in x.keys" :key="k">{{ k }}</UKbd></span>
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>
