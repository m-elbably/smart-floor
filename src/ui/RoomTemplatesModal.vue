<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from '@/editor/store'
import { setTool } from '@/editor/tools'
import { area } from '@/editor/geometry'
import { allTemplates, deleteTemplate, templateStats, type RoomTemplate } from '@/editor/templates'
import { format, formatArea } from '@/editor/units'
import RoomTemplatePreview from './RoomTemplatePreview.vue'

const query = ref('')
const selectedKind = ref('all')
const confirmDeleteId = ref<string | null>(null)

const selectedRoom = computed(() => {
  if (!store.data) return null
  return store.data.rooms.find(r => store.selection.includes(r.id)) ?? null
})

const templates = computed(() => {
  let list = allTemplates()
  if (selectedKind.value === 'custom') {
    list = list.filter(t => t.custom)
  } else if (selectedKind.value === 'other') {
    list = list.filter(t => ['generic', 'hallway', 'garage', 'storage'].includes(t.kind))
  } else if (selectedKind.value !== 'all') {
    list = list.filter(t => t.kind === selectedKind.value)
  }
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.kind.toLowerCase().includes(q)
    )
  }
  return list
})

const customCount = computed(() => (store.customTemplates ?? []).length)

const filterCategories = computed(() => [
  { id: 'all', label: 'All' },
  ...(customCount.value > 0 ? [{ id: 'custom', label: `Custom (${customCount.value})` }] : []),
  { id: 'living', label: 'Living' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining', label: 'Dining' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'office', label: 'Office' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'other', label: 'Other' }
])

function select(t: RoomTemplate) {
  const id = t.id || 'rect'
  store.toolOptions.template = id
  setTool('template')
  store.ui.templates = false
}

function remove(id: string) {
  deleteTemplate(id)
  confirmDeleteId.value = null
}

function openSaveRoom() {
  store.ui.templates = false
  store.ui.saveTemplate = true
}

const u = () => store.settings.units
</script>

<template>
  <UModal
    v-model:open="store.ui.templates"
    title="Room Templates"
    description="Choose a furnished room template to stamp on your floor plan."
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Banner if a room is selected on the canvas -->
        <div
          v-if="selectedRoom"
          class="flex items-center justify-between p-3 rounded-lg border border-primary/40 bg-primary/5"
        >
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-md bg-primary/10 text-primary">
              <UIcon name="i-lucide-bookmark-plus" class="size-5" />
            </div>
            <div>
              <p class="text-sm font-medium text-highlighted">Room selected: {{ selectedRoom.name }}</p>
              <p class="text-xs text-muted">
                {{ formatArea(area(selectedRoom.polygon), u()) }} · Save this room as a reusable template
              </p>
            </div>
          </div>
          <UButton
            icon="i-lucide-bookmark-plus"
            label="Save as template…"
            size="sm"
            color="primary"
            @click="openSaveRoom"
          />
        </div>

        <!-- Filter bar -->
        <div class="flex flex-col sm:flex-row items-center gap-2 justify-between">
          <div class="flex flex-wrap gap-1 w-full sm:w-auto">
            <UButton
              v-for="c in filterCategories"
              :key="c.id"
              size="xs"
              :variant="selectedKind === c.id ? 'soft' : 'ghost'"
              :color="selectedKind === c.id ? 'primary' : 'neutral'"
              :label="c.label"
              @click="selectedKind = c.id"
            />
          </div>
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Search templates…"
            size="sm"
            class="w-full sm:w-56"
          />
        </div>

        <!-- Templates Grid -->
        <div v-if="templates.length" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[60vh] overflow-y-auto p-0.5">
          <div
            v-for="t in templates"
            :key="t.id || t.name"
            role="button"
            tabindex="0"
            class="group relative rounded-xl border p-3 flex flex-col gap-2.5 cursor-pointer transition-all bg-elevated/40 hover:bg-elevated hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
            :class="store.tool === 'template' && store.toolOptions.template === (t.id || 'rect') ? 'border-primary ring-2 ring-primary/30' : 'border-default'"
            :aria-label="`Select template ${t.name}`"
            @click="select(t)"
            @keydown.enter="select(t)"
          >
            <!-- Card Header -->
            <div class="flex items-center justify-between gap-1.5 min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <UIcon :name="t.icon || 'i-lucide-stamp'" class="size-4 shrink-0 text-primary" />
                <span class="font-medium text-sm text-highlighted truncate">{{ t.name }}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UBadge v-if="t.custom" color="primary" variant="subtle" size="xs">Custom</UBadge>
                <UBadge
                  v-if="store.tool === 'template' && store.toolOptions.template === (t.id || 'rect')"
                  color="success"
                  variant="subtle"
                  size="xs"
                >Active</UBadge>

                <!-- Delete custom template button -->
                <template v-if="t.custom">
                  <UButton
                    v-if="confirmDeleteId !== t.id"
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    aria-label="Delete template"
                    @click.stop="confirmDeleteId = t.id!"
                  />
                  <UButton
                    v-else
                    label="Delete?"
                    size="xs"
                    color="error"
                    @click.stop="remove(t.id!)"
                    @blur="confirmDeleteId = null"
                  />
                </template>
              </div>
            </div>

            <!-- Visual SVG Preview -->
            <RoomTemplatePreview :template="t" />

            <!-- Card Footer / Details -->
            <div class="flex items-center justify-between text-xs pt-1 border-t border-default/50">
              <span class="text-muted tabular-nums">
                {{ format(templateStats(t.polygon).width, u()) }} × {{ format(templateStats(t.polygon).depth, u()) }} · {{ formatArea(templateStats(t.polygon).area, u()) }}
              </span>
              <span v-if="t.items?.length" class="text-muted flex items-center gap-1">
                <UIcon name="i-lucide-armchair" class="size-3" />
                {{ t.items.length }} item{{ t.items.length > 1 ? 's' : '' }}
              </span>
              <span v-else class="text-muted/60">No furniture</span>
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-muted text-center py-10">
          No templates found matching “{{ query }}”.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <span class="text-xs text-muted">
          Click any template to select and stamp · press <b>R</b> to rotate while stamping
        </span>
        <UButton color="neutral" variant="outline" label="Close" @click="store.ui.templates = false" />
      </div>
    </template>
  </UModal>
</template>
