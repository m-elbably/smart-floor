<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project } from '@/types'
import { store, createProject, updateProject, duplicateProject, deleteProject, openProject, refreshProjects } from '@/editor/store'
import { openFile } from '@/export/files'
import { importProject } from '@/export/project'

const toast = useToast()
// Thumbnails are JPEG bytes in SQLite; cache their data URLs per project version.
const thumbs = new Map<string, string>()
function thumbUrl(p: Project) {
  const key = `${p.id}:${p.thumbnail!.length}:${p.updatedAt}`
  let url = thumbs.get(key)
  if (!url) {
    let s = ''
    for (let i = 0; i < p.thumbnail!.length; i += 0x8000) s += String.fromCharCode(...p.thumbnail!.subarray(i, i + 0x8000))
    thumbs.set(key, (url = `data:image/jpeg;base64,${btoa(s)}`))
  }
  return url
}
// Import a shared .smartfloor file [FR-113]
async function importFile() {
  try {
    const f = await openFile({ name: 'Smart Floor project', ext: 'smartfloor' })
    if (!f) return
    const ids = await importProject(f.bytes)
    refreshProjects()
    toast.add({ title: `Imported ${f.name}`, icon: 'i-lucide-check' })
    if (ids[0]) openProject(ids[0])
  } catch (e) {
    console.error(e)
    toast.add({ title: 'That file could not be imported', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  }
}

// A furnished example to explore before drawing your own; imported as an ordinary, editable copy.
async function openSample() {
  try {
    const res = await fetch('./sample.smartfloor')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const [id] = await importProject(new Uint8Array(await res.arrayBuffer()))
    refreshProjects()
    if (id) openProject(id)
  } catch (e) {
    console.error(e)
    toast.add({ title: 'The sample could not be opened', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  }
}

const emit = defineEmits<{ settings: [] }>()
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? store.projects.filter(p => p.name.toLowerCase().includes(q)) : store.projects
})

// New / rename dialog [FR-01, FR-03]
const form = ref<{ open: boolean; id: string | null; name: string; description: string }>({
  open: false, id: null, name: '', description: ''
})
function openForm(p?: Project) {
  form.value = { open: true, id: p?.id ?? null, name: p?.name ?? '', description: p?.description ?? '' }
}
function submitForm() {
  const name = form.value.name.trim()
  if (!name) return
  if (form.value.id) updateProject(form.value.id, { name, description: form.value.description })
  else openProject(createProject(name, form.value.description).id)
  form.value.open = false
}

const toDelete = ref<Project | null>(null)
function confirmDelete() {
  if (toDelete.value) deleteProject(toDelete.value.id)
  toDelete.value = null
}

const menu = (p: Project) => [
  [
    { label: 'Open', icon: 'i-lucide-folder-open', onSelect: () => openProject(p.id) },
    { label: 'Rename', icon: 'i-lucide-pencil', onSelect: () => openForm(p) },
    { label: 'Duplicate', icon: 'i-lucide-copy', onSelect: () => duplicateProject(p.id) }
  ],
  [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => (toDelete.value = p) }]
]

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(ts: number) {
  const s = (ts - Date.now()) / 1000
  for (const [unit, sec] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const)
    if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit)
  return 'just now'
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="flex items-center gap-3 px-6 py-4 border-b border-default">
      <img :src="'./icon.png'" alt="" class="size-7" />
      <h1 class="text-xl font-semibold">Smart Floor</h1>
      <div class="flex-1" />
      <UInput v-model="search" icon="i-lucide-search" placeholder="Search projects" class="w-64" />
      <UButton icon="i-lucide-settings" color="neutral" variant="ghost" aria-label="Settings" @click="emit('settings')" />
      <UButton icon="i-lucide-file-up" label="Import" color="neutral" variant="outline" @click="importFile" />
      <UButton icon="i-lucide-plus" label="New project" @click="openForm()" />
    </header>

    <main class="flex-1 overflow-auto p-6">
      <UEmpty
        v-if="!store.projects.length"
        icon="i-lucide-house-plus"
        title="No projects yet"
        description="Create your first project, or open the sample house to look around first."
        :actions="[
          { label: 'New project', icon: 'i-lucide-plus', onClick: () => openForm() },
          { label: 'Open sample house', icon: 'i-lucide-house', color: 'neutral', variant: 'outline', onClick: openSample }
        ]"
        class="mt-24"
      />
      <p v-else-if="!filtered.length" class="text-muted text-center mt-24">No projects match “{{ search }}”.</p>

      <div v-else class="grid gap-5 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        <UCard
          v-for="p in filtered"
          :key="p.id"
          class="group cursor-pointer transition hover:ring-2 hover:ring-primary hover:-translate-y-0.5"
          :ui="{ body: 'p-0 sm:p-0' }"
          @click="openProject(p.id)"
        >
          <img v-if="p.thumbnail" :src="thumbUrl(p)" alt="" class="aspect-video w-full object-cover rounded-t-lg bg-elevated" />
          <div v-else class="aspect-video bg-gradient-to-br from-primary/15 to-elevated grid place-items-center rounded-t-lg">
            <UIcon name="i-lucide-house" class="size-12 text-primary/60 transition group-hover:scale-110" />
          </div>
          <div class="flex items-start gap-2 p-4">
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ p.name }}</p>
              <p class="text-xs text-muted">Edited {{ ago(p.updatedAt) }}</p>
            </div>
            <UDropdownMenu :items="menu(p)" :content="{ align: 'end' }">
              <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="sm" aria-label="Project actions" @click.stop />
            </UDropdownMenu>
          </div>
        </UCard>
      </div>
    </main>

    <UModal v-model:open="form.open" :title="form.id ? 'Rename project' : 'New project'">
      <template #body>
        <form id="project-form" class="flex flex-col gap-4" @submit.prevent="submitForm">
          <UFormField label="Name" required>
            <UInput v-model="form.name" autofocus placeholder="My house" class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="form.description" :rows="2" class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="form.open = false" />
          <UButton type="submit" form="project-form" :label="form.id ? 'Save' : 'Create'" :disabled="!form.name.trim()" />
        </div>
      </template>
    </UModal>

    <UModal :open="!!toDelete" title="Delete project?" @update:open="v => !v && (toDelete = null)">
      <template #body>
        <p>“{{ toDelete?.name }}” and all its floors, rooms and furniture will be deleted. This cannot be undone.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="toDelete = null" />
          <UButton label="Delete" color="error" icon="i-lucide-trash-2" @click="confirmDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
