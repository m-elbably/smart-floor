<script setup lang="ts">
// Furniture catalog: search, category chips, favourites + recent rows, thumbnail cards.
// Click a card to arm the item tool, or drag it onto the canvas.
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { store, saveSettings } from '@/editor/store'
import { setTool } from '@/editor/tools'
import { CATALOG, CATEGORIES, catalogItem, catalogState, search, thumbnail, type CatalogItem, type Category } from '@/catalog'
import { format } from '@/editor/units'

const query = ref('')
const category = ref<Category | 'all'>('all')
const categoryOptions = computed(() => [
  { value: 'all', label: `All categories (${CATALOG.length})`, icon: 'i-lucide-layout-grid' },
  ...CATEGORIES.map(c => ({
    value: c.id,
    label: `${c.label} (${CATALOG.filter(i => i.category === c.id).length})`,
    icon: c.icon
  }))
])
const selectedCategoryIcon = computed(
  () => categoryOptions.value.find(c => c.value === category.value)?.icon ?? 'i-lucide-layout-grid'
)

const list = computed(() => search(query.value, category.value === 'all' ? CATALOG : CATALOG.filter(i => i.category === category.value)))
const favs = computed(() => store.settings.favourites.map(catalogItem).filter((i): i is CatalogItem => !!i))
const recent = computed(() => store.settings.recent.map(catalogItem).filter((i): i is CatalogItem => !!i))
const showRows = computed(() => !query.value && category.value === 'all')

// Thumbnails render one per frame so opening the panel never stalls.
const thumbs = reactive<Record<string, string>>({})
let queue: CatalogItem[] = []
let raf = 0
function pump() {
  raf = 0
  const next = queue.shift()
  if (!next) return
  thumbs[next.id] = thumbnail(next)
  raf = requestAnimationFrame(pump)
}
watch(
  () => catalogState.version,
  () => {
    queue = [...CATALOG]
    if (!raf) raf = requestAnimationFrame(pump)
  },
  { immediate: true }
)
onBeforeUnmount(() => cancelAnimationFrame(raf))

function arm(item: CatalogItem) {
  store.toolOptions.item = item.id
  setTool('item')
}
function onDragStart(e: DragEvent, item: CatalogItem) {
  e.dataTransfer?.setData('text/plain', item.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
  arm(item)
}
function toggleFav(item: CatalogItem) {
  const f = store.settings.favourites
  saveSettings({ favourites: f.includes(item.id) ? f.filter(id => id !== item.id) : [...f, item.id] })
}
const dims = (i: CatalogItem) => `${format(i.size[0], store.settings.units)} × ${format(i.size[1], store.settings.units)}`

function closeCatalog() {
  store.catalogOpen = false
  if (store.tool === 'item') setTool('select')
}
</script>

<template>
  <aside class="w-64 shrink-0 flex flex-col border-r border-default bg-default min-h-0" aria-label="Furniture catalog">
    <header class="flex items-center justify-between px-3 h-11 border-b border-default">
      <h2 class="font-semibold text-highlighted">Furniture</h2>
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" aria-label="Close catalog" @click="closeCatalog" />
    </header>
    <div class="p-2 flex flex-col gap-2 border-b border-default">
      <UInput v-model="query" icon="i-lucide-search" placeholder="Search sofa, bed, tree…" size="sm" aria-label="Search catalog" />
      <USelect
        :model-value="category"
        :items="categoryOptions"
        :icon="selectedCategoryIcon"
        size="sm"
        class="w-full"
        aria-label="Filter category"
        @update:model-value="(v: unknown) => (category = v as Category | 'all')"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
      <template v-for="section in showRows ? [{ title: 'Favourites', items: favs }, { title: 'Recent', items: recent }] : []" :key="section.title">
        <section v-if="section.items.length">
          <h3 class="text-xs font-medium text-muted mb-1">{{ section.title }}</h3>
          <div class="flex gap-1 overflow-x-auto pb-1">
            <button
              v-for="i in section.items"
              :key="i.id"
              draggable="true"
              class="shrink-0 w-14 rounded border border-default hover:border-primary bg-elevated/40"
              :title="i.name"
              @click="arm(i)"
              @dragstart="onDragStart($event, i)"
            >
              <img v-if="thumbs[i.id]" :src="thumbs[i.id]" :alt="i.name" class="w-full aspect-square" draggable="false" />
            </button>
          </div>
        </section>
      </template>

      <p v-if="!list.length" class="text-sm text-muted text-center py-6">Nothing matches “{{ query }}”.</p>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="i in list"
          :key="i.id"
          draggable="true"
          role="button"
          tabindex="0"
          class="group relative rounded-md border p-1.5 cursor-grab transition-colors hover:border-primary bg-elevated/40 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          :class="store.tool === 'item' && store.toolOptions.item === i.id ? 'border-primary ring-1 ring-primary' : 'border-default'"
          :aria-label="`Place ${i.name}`"
          @click="arm(i)"
          @keydown.enter="arm(i)"
          @dragstart="onDragStart($event, i)"
        >
          <img v-if="thumbs[i.id]" :src="thumbs[i.id]" :alt="i.name" class="w-full aspect-square" draggable="false" />
          <div v-else class="w-full aspect-square grid place-items-center"><UIcon name="i-lucide-loader" class="animate-spin text-muted" /></div>
          <p class="text-xs text-default truncate mt-1">{{ i.name }}</p>
          <p class="text-[10px] text-muted tabular-nums">{{ dims(i) }}</p>
          <UButton
            :icon="store.settings.favourites.includes(i.id) ? 'i-lucide-star' : 'i-lucide-star'"
            size="xs"
            :color="store.settings.favourites.includes(i.id) ? 'warning' : 'neutral'"
            variant="ghost"
            class="absolute top-1 right-1"
            :class="!store.settings.favourites.includes(i.id) && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100'"
            :aria-label="store.settings.favourites.includes(i.id) ? 'Remove from favourites' : 'Add to favourites'"
            @click.stop="toggleFav(i)"
          />
        </div>
      </div>
    </div>
  </aside>
</template>
