<script setup lang="ts">
// Manage the floor stack: rename, height, slab, reorder, delete [FR-11]
import { computed, ref } from 'vue'
import { store, updateFloor, moveFloor, removeFloor, addFloor } from '@/editor/store'
import { format } from '@/editor/units'
import LengthInput from './LengthInput.vue'

const open = defineModel<boolean>('open', { default: false })
const floors = computed(() => [...(store.data?.floors ?? [])].sort((a, b) => b.level - a.level)) // top first
const confirmId = ref<string | null>(null)
</script>

<template>
  <UModal v-model:open="open" title="Floors" description="Top floor first. Elevations update automatically." :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <table class="w-full text-sm">
        <thead class="text-muted text-left">
          <tr>
            <th class="font-normal pb-2">Name</th>
            <th class="font-normal pb-2 w-28">Height</th>
            <th class="font-normal pb-2 w-28">Slab</th>
            <th class="font-normal pb-2 w-24">Elevation</th>
            <th class="w-36"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(f, i) in floors" :key="f.id" :class="f.id === store.activeFloorId && 'bg-elevated/60'">
            <td class="py-1 pr-2">
              <UInput :model-value="f.name" size="sm" class="w-full" @change="(e: Event) => updateFloor(f.id, { name: (e.target as HTMLInputElement).value.trim() || f.name })" />
            </td>
            <td class="pr-2"><LengthInput :model-value="f.height" :min="1.8" :max="10" @update:model-value="v => updateFloor(f.id, { height: v })" /></td>
            <td class="pr-2"><LengthInput :model-value="f.slab" :min="0" :max="1" @update:model-value="v => updateFloor(f.id, { slab: v })" /></td>
            <td class="text-muted tabular-nums">{{ format(f.elevation, store.settings.units) }}</td>
            <td class="text-right whitespace-nowrap">
              <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" aria-label="Move up" @click="moveFloor(f.id, 1)" />
              <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === floors.length - 1" aria-label="Move down" @click="moveFloor(f.id, -1)" />
              <UButton
                v-if="confirmId !== f.id"
                icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" aria-label="Delete floor"
                :disabled="floors.length === 1"
                @click="confirmId = f.id"
              />
              <UButton v-else label="Delete?" size="xs" color="error" @click="removeFloor(f.id), (confirmId = null)" @blur="confirmId = null" />
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #footer>
      <div class="flex gap-2 w-full">
        <UButton icon="i-lucide-arrow-up-from-line" label="Add floor above" variant="soft" @click="addFloor('above')" />
        <UButton icon="i-lucide-arrow-down-to-line" label="Add basement" variant="soft" color="neutral" @click="addFloor('below')" />
        <div class="flex-1" />
        <UButton label="Done" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>
