<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store, activeFloor, addFloor, closeProject, updateProject, duplicateFloorAbove } from '@/editor/store'
import { format } from '@/editor/units'
import { undo, redo, history } from '@/editor/commands'
import { notify } from '@/editor/store'
import { exportProject } from '@/export/project'
import { saveFile, slug } from '@/export/files'
import { save } from '@/db/sqlite'

async function exportProjectFile() {
  if (!store.data) return
  try {
    await save() // flush pending edits first
    const path = await saveFile(`${slug(store.data.project.name)}.smartfloor`, await exportProject(store.data.project.id), { name: 'Smart Floor project', ext: 'smartfloor' })
    if (path) notify(`Saved ${path}`)
  } catch (e) {
    notify(`Export failed: ${(e as Error).message}`)
  }
}
// Text exports with no options, so they save straight away: vector plans of the active floor, or the quantities.
const TEXT_EXPORTS = {
  svg: { name: 'SVG image', build: async () => (await import('@/export/svg')).buildSvg(store.data!, store.settings, activeFloor.value!.id), floor: true },
  dxf: { name: 'DXF drawing', build: async () => (await import('@/export/dxf')).buildDxf(store.data!, store.settings, activeFloor.value!.id), floor: true },
  csv: { name: 'CSV spreadsheet', build: async () => (await import('@/export/schedule')).buildSchedule(store.data!, store.settings.units), floor: false }
}
async function exportText(ext: keyof typeof TEXT_EXPORTS) {
  if (!store.data || !activeFloor.value) return
  const x = TEXT_EXPORTS[ext]
  try {
    const name = `${slug(store.data.project.name)}-${x.floor ? slug(activeFloor.value.name) : 'quantities'}.${ext}`
    const path = await saveFile(name, new TextEncoder().encode(await x.build()), { name: x.name, ext })
    if (path) notify(`Saved ${path}`)
  } catch (e) {
    notify(`Export failed: ${(e as Error).message}`)
  }
}
const exportItems = [
  [
    { label: 'Image (PNG)…', icon: 'i-lucide-image', onSelect: () => (store.ui.export = 'png') },
    { label: '3D model (GLB)…', icon: 'i-lucide-file-box', onSelect: () => (store.ui.export = 'glb') },
    { label: 'Printable plan (PDF)…', icon: 'i-lucide-file-text', onSelect: () => (store.ui.export = 'pdf') }
  ],
  [
    { label: 'Plan as SVG (this floor)…', icon: 'i-lucide-pen-tool', onSelect: () => exportText('svg') },
    { label: 'Plan for CAD, DXF (this floor)…', icon: 'i-lucide-drafting-compass', onSelect: () => exportText('dxf') }
  ],
  [{ label: 'Quantities (CSV)…', icon: 'i-lucide-sheet', onSelect: () => exportText('csv') }],
  [{ label: 'Project file (.smartfloor)…', icon: 'i-lucide-file-down', onSelect: exportProjectFile }]
]

const emit = defineEmits<{ floors: []; settings: [] }>()

const name = ref('')
watch(() => store.data?.project.name, n => (name.value = n ?? ''), { immediate: true })
function commitName() {
  const n = name.value.trim()
  if (n && store.data && n !== store.data.project.name) updateProject(store.data.project.id, { name: n })
  else name.value = store.data?.project.name ?? ''
}

const floorItems = computed(() =>
  [...(store.data?.floors ?? [])].sort((a, b) => b.level - a.level).map(f => ({ label: f.name, value: f.id }))
)

// PageUp / PageDown (editor/shortcuts.ts) and these buttons walk the floor stack [FR-12]
function stepFloor(dir: 1 | -1) {
  const sorted = [...(store.data?.floors ?? [])].sort((a, b) => a.level - b.level)
  const next = sorted[sorted.findIndex(f => f.id === store.activeFloorId) + dir]
  if (next) store.activeFloorId = next.id
}

const addItems = [
  [
    { label: 'Add floor above', icon: 'i-lucide-arrow-up-from-line', onSelect: () => addFloor('above') },
    { label: 'Add basement', icon: 'i-lucide-arrow-down-to-line', onSelect: () => addFloor('below') },
    { label: 'Duplicate this floor on top', icon: 'i-lucide-copy-plus', onSelect: () => duplicateFloorAbove(store.activeFloorId) }
  ],
  [{ label: 'Manage floors…', icon: 'i-lucide-layers', onSelect: () => emit('floors') }]
]
</script>

<template>
  <header class="flex items-center gap-2 px-3 h-12 border-b border-default bg-default">
    <UTooltip text="Back to projects">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" aria-label="Back to projects" @click="closeProject" />
    </UTooltip>
    <UInput
      v-model="name"
      variant="ghost"
      class="w-56 font-medium"
      aria-label="Project name"
      @blur="commitName"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />
    <USeparator orientation="vertical" class="h-6" />
    <UIcon name="i-lucide-layers" class="text-muted" />
    <USelect
      :model-value="store.activeFloorId"
      :items="floorItems"
      class="w-44"
      aria-label="Active floor"
      @update:model-value="(v: unknown) => (store.activeFloorId = v as string)"
    />
    <UTooltip text="Floor below / above" :kbds="['PageDown']">
      <UFieldGroup>
        <UButton icon="i-lucide-chevron-down" color="neutral" variant="outline" aria-label="Floor below" @click="stepFloor(-1)" />
        <UButton icon="i-lucide-chevron-up" color="neutral" variant="outline" aria-label="Floor above" @click="stepFloor(1)" />
      </UFieldGroup>
    </UTooltip>
    <UDropdownMenu :items="addItems">
      <UButton icon="i-lucide-plus" color="neutral" variant="ghost" aria-label="Floor actions" />
    </UDropdownMenu>
    <span v-if="activeFloor" class="text-xs text-muted">h {{ format(activeFloor.height, store.settings.units) }}</span>
    <div class="flex-1" />
    <UFieldGroup>
      <UTooltip :text="history.undo ? `Undo ${history.undo}` : 'Nothing to undo'" :kbds="['meta', 'z']">
        <UButton icon="i-lucide-undo-2" color="neutral" variant="ghost" aria-label="Undo" :disabled="!history.undo" @click="undo" />
      </UTooltip>
      <UTooltip :text="history.redo ? `Redo ${history.redo}` : 'Nothing to redo'" :kbds="['meta', 'shift', 'z']">
        <UButton icon="i-lucide-redo-2" color="neutral" variant="ghost" aria-label="Redo" :disabled="!history.redo" @click="redo" />
      </UTooltip>
    </UFieldGroup>
    <UDropdownMenu :items="exportItems">
      <UButton icon="i-lucide-download" label="Export" color="neutral" variant="ghost" />
    </UDropdownMenu>
    <UTooltip text="Areas & summary" :kbds="['shift', 's']">
      <UButton icon="i-lucide-sigma" color="neutral" :variant="store.ui.summary ? 'soft' : 'ghost'" aria-label="Areas and summary" @click="store.ui.summary = !store.ui.summary" />
    </UTooltip>
    <UTooltip text="Command palette" :kbds="['meta', 'k']">
      <UButton icon="i-lucide-search" color="neutral" variant="ghost" aria-label="Command palette" @click="store.ui.palette = true" />
    </UTooltip>
    <UTooltip text="Keyboard shortcuts" :kbds="['?']">
      <UButton icon="i-lucide-keyboard" color="neutral" variant="ghost" aria-label="Keyboard shortcuts" @click="store.ui.help = true" />
    </UTooltip>
    <UButton icon="i-lucide-settings" color="neutral" variant="ghost" aria-label="Settings" @click="emit('settings')" />
  </header>
</template>
