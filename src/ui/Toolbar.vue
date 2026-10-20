<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store } from '@/editor/store'
import { setTool } from '@/editor/tools'
import { TOOLS, openCatalog } from '@/editor/shortcuts'
import { openTemplates } from '@/editor/templates'
import { ZONE_KINDS } from '@/editor/presets'
import { execute, updateProjectCmd } from '@/editor/commands'

const standardGroups = computed(() => [
  { name: 'Edit', tools: TOOLS.filter(t => t.group === 'Edit') },
  { name: 'Build', tools: TOOLS.filter(t => t.group === 'Build') }
])

const active = (id: string) => store.tool === id

// Place section: Furniture vs Outdoor & Site
const isFurnitureActive = computed(() => store.catalogOpen && store.tool === 'item')
const isOutdoorActive = computed(() => store.tool === 'zone' || store.tool === 'site')

const lastOutdoor = ref<'zone' | 'site'>('zone')
watch(
  () => store.tool,
  t => {
    if (t === 'zone' || t === 'site') lastOutdoor.value = t
  }
)

const currentOutdoorTool = computed(() => {
  if (store.tool === 'site') return 'site'
  if (store.tool === 'zone') return 'zone'
  return lastOutdoor.value
})

const outdoorIcon = computed(() => {
  if (currentOutdoorTool.value === 'site') return 'i-lucide-land-plot'
  return ZONE_KINDS[store.toolOptions.zone]?.icon ?? 'i-lucide-trees'
})

const outdoorTooltip = computed(() => {
  if (store.tool === 'site') return 'Site boundary (B) · Click for outdoor tools'
  if (store.tool === 'zone') return `Garden zone: ${ZONE_KINDS[store.toolOptions.zone]?.label ?? 'Grass'} (G) · Click for outdoor tools`
  return 'Outdoor & Site (G / B) · Click for tools'
})

function toggleFurniture() {
  if (store.catalogOpen) {
    store.catalogOpen = false
    if (store.tool === 'item') setTool('select')
  } else {
    openCatalog()
  }
}

const outdoorMenuItems = computed(() => [
  [
    {
      label: 'Garden zone',
      icon: 'i-lucide-trees',
      kbds: ['G'],
      checked: store.tool === 'zone',
      type: 'checkbox' as const,
      children: [
        {
          label: `Draw ${ZONE_KINDS[store.toolOptions.zone]?.label ?? 'Garden zone'}`,
          icon: ZONE_KINDS[store.toolOptions.zone]?.icon ?? 'i-lucide-trees',
          kbds: ['G'],
          onSelect: () => {
            setTool('zone')
          }
        },
        { type: 'separator' as const },
        ...Object.entries(ZONE_KINDS).map(([kind, z]) => ({
          label: z.label,
          icon: z.icon,
          checked: store.tool === 'zone' && store.toolOptions.zone === kind,
          type: 'checkbox' as const,
          onSelect: () => {
            store.toolOptions.zone = kind
            setTool('zone')
          }
        }))
      ]
    },
    {
      label: 'Site boundary',
      icon: 'i-lucide-land-plot',
      kbds: ['B'],
      checked: store.tool === 'site',
      type: 'checkbox' as const,
      onSelect: () => {
        setTool('site')
      }
    }
  ],
  ...(store.data?.project.site
    ? [
        [
          {
            label: 'Clear site boundary',
            icon: 'i-lucide-trash-2',
            color: 'error' as const,
            onSelect: () => {
              execute(updateProjectCmd({ site: null }, 'Clear site boundary'))
            }
          }
        ]
      ]
    : [])
])
</script>

<template>
  <nav class="flex flex-col gap-3 px-1.5 py-2 border-r border-default bg-default overflow-y-auto" aria-label="Tools">
    <!-- Edit & Build Groups -->
    <div v-for="g in standardGroups" :key="g.name" role="group" :aria-label="g.name" class="flex flex-col items-center gap-1">
      <span class="text-[10px] leading-none font-medium text-dimmed select-none">{{ g.name }}</span>
      <div class="flex flex-col gap-0.5 p-0.5 rounded-lg bg-elevated/60">
        <UTooltip v-for="t in g.tools" :key="t.id" :text="t.label" :kbds="[t.key]" :content="{ side: 'right' }">
          <UButton
            :icon="t.icon"
            :aria-label="t.label"
            :color="active(t.id) ? 'primary' : 'neutral'"
            :variant="active(t.id) ? 'soft' : 'ghost'"
            size="lg"
            @click="t.id === 'template' ? openTemplates() : setTool(t.id)"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Place Group -->
    <div role="group" aria-label="Place" class="flex flex-col items-center gap-1">
      <span class="text-[10px] leading-none font-medium text-dimmed select-none">Place</span>
      <div class="flex flex-col gap-0.5 p-0.5 rounded-lg bg-elevated/60">
        <!-- Furniture button -->
        <UTooltip text="Furniture (catalog)" :kbds="['f']" :content="{ side: 'right' }">
          <UButton
            icon="i-lucide-armchair"
            aria-label="Furniture (catalog)"
            :color="isFurnitureActive ? 'primary' : 'neutral'"
            :variant="isFurnitureActive ? 'soft' : 'ghost'"
            size="lg"
            @click="toggleFurniture"
          />
        </UTooltip>

        <!-- Outdoor & Site grouped button with Submenu -->
        <UDropdownMenu :items="outdoorMenuItems" :content="{ side: 'right', align: 'start' }">
          <UTooltip :text="outdoorTooltip" :content="{ side: 'right' }">
            <div class="relative">
              <UButton
                :icon="outdoorIcon"
                :aria-label="outdoorTooltip"
                :color="isOutdoorActive ? 'primary' : 'neutral'"
                :variant="isOutdoorActive ? 'soft' : 'ghost'"
                size="lg"
              />
              <span class="absolute bottom-1 right-1 pointer-events-none border-solid border-b-[4px] border-r-[4px] border-l-transparent border-t-transparent border-r-current border-b-current opacity-60"></span>
            </div>
          </UTooltip>
        </UDropdownMenu>
      </div>
    </div>
  </nav>
</template>
