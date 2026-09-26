<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store, activeFloor } from '@/editor/store'
import { format } from '@/editor/units'
import TopBar from './TopBar.vue'
import FloorsModal from './FloorsModal.vue'
import Viewport from './Viewport.vue'
import Toolbar from './Toolbar.vue'
import CatalogPanel from './CatalogPanel.vue'
import ToolOptions from './ToolOptions.vue'
import Inspector from './Inspector.vue'
import CommandPalette from './CommandPalette.vue'
import HelpModal from './HelpModal.vue'
import ConfirmModal from './ConfirmModal.vue'
import SummaryPanel from './SummaryPanel.vue'

const emit = defineEmits<{ settings: [] }>()
const floorsOpen = ref(false)
const viewport = ref<InstanceType<typeof Viewport>>()
const toast = useToast()
watch(
  () => store.notice.n,
  () => toast.add({ title: store.notice.text, icon: 'i-lucide-info', duration: 2500 })
)
const snapLabel = { vertex: 'corner', midpoint: 'midpoint', edge: 'wall', align: 'aligned', angle: 'angle', grid: 'grid' } as const

const visibilityItems = [
  { label: 'Active floor only', value: 'active', icon: 'i-lucide-square' },
  { label: 'Ghost floor below', value: 'ghost', icon: 'i-lucide-layers-2' },
  { label: 'All floors', value: 'all', icon: 'i-lucide-layers-3' }
]
const presetItems = computed(() => [
  [
    { type: 'label' as const, label: 'Camera' },
    { label: 'Top', icon: 'i-lucide-arrow-down-to-dot', onSelect: () => viewport.value?.preset('top') },
    { label: 'Front', icon: 'i-lucide-arrow-right-to-line', onSelect: () => viewport.value?.preset('front') },
    { label: 'Isometric', icon: 'i-lucide-box', onSelect: () => viewport.value?.preset('iso') }
  ],
  [
    { type: 'checkbox' as const, label: 'Room labels', icon: 'i-lucide-tag', checked: store.showLabels, onUpdateChecked: (v: boolean) => (store.showLabels = v), onSelect: (e: Event) => e.preventDefault() },
    { type: 'checkbox' as const, label: 'Wall dimensions', icon: 'i-lucide-ruler-dimension-line', checked: store.showDims, onUpdateChecked: (v: boolean) => (store.showDims = v), onSelect: (e: Event) => e.preventDefault() }
  ]
])

const saveLabel = { saved: 'Saved', dirty: 'Unsaved', saving: 'Saving…', error: 'Save failed' } as const
const saveIcon = { saved: 'i-lucide-check', dirty: 'i-lucide-circle-dot', saving: 'i-lucide-loader', error: 'i-lucide-triangle-alert' } as const
</script>

<template>
  <div class="h-full flex flex-col">
    <TopBar @floors="floorsOpen = true" @settings="emit('settings')" />

    <div class="flex-1 flex min-h-0">
    <Toolbar />
    <CatalogPanel v-if="store.catalogOpen" />
    <main class="flex-1 relative min-h-0 min-w-0">
      <Viewport ref="viewport" />
      <div class="absolute top-3 left-3">
        <ToolOptions v-if="store.view !== 'walk'" />
      </div>
      <!-- Walk mode hint -->
      <div
        v-if="store.view === 'walk'"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-inverted/85 text-inverted text-xs px-4 py-2 shadow"
      >
        <UIcon name="i-lucide-person-standing" class="size-4" />
        <b>{{ activeFloor?.name }}</b>
        <span v-if="store.walkLocked">WASD move · mouse look · Shift run · Esc exit</span>
        <span v-else>Click the view to look around · WASD move · Esc exit</span>
      </div>
      <div class="absolute top-3 right-3 flex gap-2">
        <USelect
          v-model="store.floorVisibility"
          :items="visibilityItems"
          :icon="visibilityItems.find(i => i.value === store.floorVisibility)?.icon"
          class="w-48"
          aria-label="Floor visibility"
        />
        <UTooltip text="2D plan · 3D · Walk through" :kbds="['Tab']">
          <UFieldGroup>
            <UButton
              v-for="v in (['2d', '3d', 'walk'] as const)"
              :key="v"
              :label="v === 'walk' ? undefined : v.toUpperCase()"
              :icon="v === 'walk' ? 'i-lucide-person-standing' : undefined"
              :aria-label="v === 'walk' ? 'Walk through' : `${v.toUpperCase()} view`"
              color="neutral"
              :variant="store.view === v ? 'solid' : 'outline'"
              @click="store.view = v"
            />
          </UFieldGroup>
        </UTooltip>
        <UDropdownMenu :items="presetItems">
          <UButton icon="i-lucide-eye" color="neutral" variant="outline" aria-label="View options" />
        </UDropdownMenu>
      </div>
    </main>
    <Inspector />
    </div>

    <footer class="flex items-center gap-4 px-3 h-7 text-xs text-muted border-t border-default bg-default">
      <span>{{ store.settings.units === 'metric' ? 'Metric' : 'Imperial' }}</span>
      <span>Grid {{ format(store.settings.grid, store.settings.units) }}</span>
      <span v-if="activeFloor">{{ activeFloor.name }} · {{ format(activeFloor.elevation, store.settings.units) }}</span>
      <span v-if="store.cursor" class="tabular-nums">
        x {{ format(store.cursor[0], store.settings.units) }} &nbsp; y {{ format(store.cursor[1], store.settings.units) }}
      </span>
      <span v-if="store.cursor && store.snapKind && store.snapKind !== 'grid'" class="flex items-center gap-1 text-warning">
        <UIcon name="i-lucide-magnet" /> {{ snapLabel[store.snapKind] }}
      </span>
      <span class="truncate min-w-0">{{ store.hint }}</span>
      <div class="flex-1" />
      <span class="flex items-center gap-1 shrink-0" :class="store.saveState === 'error' && 'text-error'">
        <UIcon :name="saveIcon[store.saveState]" :class="store.saveState === 'saving' && 'animate-spin'" />
        {{ saveLabel[store.saveState] }}
      </span>
    </footer>

    <FloorsModal v-model:open="floorsOpen" />
    <CommandPalette />
    <HelpModal />
    <ConfirmModal />
    <SummaryPanel />
  </div>
</template>
