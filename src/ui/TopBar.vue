<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store, activeFloor, addFloor, closeProject, updateProject } from '@/editor/store'
import { format } from '@/editor/units'

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

// PageUp / PageDown walk the floor stack [FR-12]
function stepFloor(dir: 1 | -1) {
  const sorted = [...(store.data?.floors ?? [])].sort((a, b) => a.level - b.level)
  const next = sorted[sorted.findIndex(f => f.id === store.activeFloorId) + dir]
  if (next) store.activeFloorId = next.id
}
defineShortcuts({ pageup: () => stepFloor(1), pagedown: () => stepFloor(-1) })

const addItems = [
  [
    { label: 'Add floor above', icon: 'i-lucide-arrow-up-from-line', onSelect: () => addFloor('above') },
    { label: 'Add basement', icon: 'i-lucide-arrow-down-to-line', onSelect: () => addFloor('below') }
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
    <UButton icon="i-lucide-settings" color="neutral" variant="ghost" aria-label="Settings" @click="emit('settings')" />
  </header>
</template>
