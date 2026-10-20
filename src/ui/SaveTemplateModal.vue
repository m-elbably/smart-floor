<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store } from '@/editor/store'
import { pointInPolygon, bbox } from '@/editor/geometry'
import { ROOM_KINDS } from '@/editor/presets'
import { extractRoomAsTemplate, saveRoomAsTemplate } from '@/editor/templates'
import { format } from '@/editor/units'
import { catalogItem } from '@/catalog'
import RoomTemplatePreview from './RoomTemplatePreview.vue'

const room = computed(() => {
  if (!store.data) return null
  return store.data.rooms.find(r => store.selection.includes(r.id)) ?? null
})

const insideItems = computed(() => {
  if (!room.value || !store.data) return []
  return store.data.items.filter(
    it => it.floorId === room.value!.floorId && pointInPolygon([it.x, it.y], room.value!.polygon)
  )
})

const name = ref('')
const label = ref('')
const kind = ref('generic')
const includeItems = ref(true)

const kindItems = ROOM_KINDS.map(k => ({
  value: k as string,
  label: k[0].toUpperCase() + k.slice(1)
}))

watch(
  () => store.ui.saveTemplate,
  open => {
    if (open && room.value) {
      name.value = room.value.name
      kind.value = room.value.kind || 'generic'
      includeItems.value = insideItems.value.length > 0
      const b = bbox(room.value.polygon)
      const w = Math.round((b.max[0] - b.min[0]) * 10) / 10
      const d = Math.round((b.max[1] - b.min[1]) * 10) / 10
      label.value = `${room.value.name} ${format(w, store.settings.units)} × ${format(d, store.settings.units)}`
    }
  }
)

const previewTemplate = computed(() => {
  if (!room.value || !store.data) return null
  return extractRoomAsTemplate(room.value, store.data.items, {
    name: name.value,
    label: label.value,
    kind: kind.value,
    includeItems: includeItems.value
  })
})

function save() {
  if (!room.value || !store.data) return
  saveRoomAsTemplate(room.value, store.data.items, {
    name: name.value.trim() || room.value.name,
    label: label.value.trim(),
    kind: kind.value,
    includeItems: includeItems.value
  })
  store.ui.saveTemplate = false
}
</script>

<template>
  <UModal
    v-model:open="store.ui.saveTemplate"
    title="Save Room as Template"
    description="Save this room layout and furniture as a reusable template."
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div v-if="room && previewTemplate" class="flex flex-col gap-4">
        <!-- Live Template Preview -->
        <RoomTemplatePreview :template="previewTemplate" />

        <UFormField label="Template name" required>
          <UInput v-model="name" placeholder="e.g. Master Bedroom" class="w-full" />
        </UFormField>

        <UFormField label="Display label" help="Shown in the templates browser">
          <UInput v-model="label" placeholder="e.g. Master Bedroom 4.5 × 4 m" class="w-full" />
        </UFormField>

        <UFormField label="Room kind">
          <USelect v-model="kind" :items="kindItems" class="w-full" />
        </UFormField>

        <div v-if="insideItems.length > 0" class="pt-2 border-t border-default flex flex-col gap-2">
          <USwitch
            v-model="includeItems"
            :label="`Include furniture (${insideItems.length} item${insideItems.length > 1 ? 's' : ''})`"
          />
          <p class="text-xs text-muted">
            Includes: {{ [...new Set(insideItems.map(i => catalogItem(i.catalogId)?.name || i.catalogId))].join(', ') }}
          </p>
        </div>
      </div>
      <p v-else class="text-sm text-muted text-center py-6">
        No room currently selected. Select a room on the floor plan to save it as a template.
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" label="Cancel" @click="store.ui.saveTemplate = false" />
        <UButton :disabled="!room" icon="i-lucide-bookmark-plus" label="Save to Templates" @click="save" />
      </div>
    </template>
  </UModal>
</template>
