<script setup lang="ts">
// Export options (PNG / GLB / PDF) → save dialog. Project files export straight from the menu.
import { computed, reactive, ref } from 'vue'
import { store, activeFloor, notify } from '@/editor/store'
import { saveFile, slug } from '@/export/files'
import type { PdfOptions } from '@/export/pdf'

const props = defineProps<{ snapshot: (scale: number) => Promise<Uint8Array>; glb: (activeOnly: boolean) => Promise<Uint8Array> }>()
const busy = ref(false)
const png = reactive({ scale: 2 })
const glb = reactive({ scope: 'all' as 'all' | 'active' })
const pdf = reactive<PdfOptions>({ paper: 'a4', orientation: 'landscape', scale: 100, floors: 'active' })

const titles = { png: 'Export image (PNG)', glb: 'Export 3D model (GLB)', pdf: 'Export printable plan (PDF)' } as const
const open = computed({ get: () => !!store.ui.export, set: v => !v && (store.ui.export = null) })
const base = () => slug(store.data?.project.name ?? 'project')

async function run() {
  const kind = store.ui.export
  if (!kind || !store.data) return
  busy.value = true
  try {
    let saved: string | null = null
    if (kind === 'png') saved = await saveFile(`${base()}.png`, await props.snapshot(png.scale), { name: 'PNG image', ext: 'png' })
    else if (kind === 'glb') saved = await saveFile(`${base()}.glb`, await props.glb(glb.scope === 'active'), { name: 'glTF binary', ext: 'glb' })
    else {
      const { buildPdf } = await import('@/export/pdf') // lazy: jsPDF is ~400 KB
      const out = buildPdf(store.data, store.settings, pdf, activeFloor.value!.id)
      out.warnings.forEach(notify)
      saved = await saveFile(`${base()}-plan.pdf`, out.bytes, { name: 'PDF document', ext: 'pdf' })
    }
    if (saved) {
      notify(`Saved ${saved}`)
      store.ui.export = null
    }
  } catch (e) {
    console.error(e)
    notify(`Export failed: ${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="store.ui.export ? titles[store.ui.export] : ''">
    <template #body>
      <div class="flex flex-col gap-4">
        <template v-if="store.ui.export === 'png'">
          <UFormField label="Resolution" help="Of the current view, as shown on screen (labels are not included).">
            <URadioGroup v-model="png.scale" orientation="horizontal" :items="[{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 4, label: '4×' }]" />
          </UFormField>
        </template>
        <template v-else-if="store.ui.export === 'glb'">
          <UFormField label="What to export" help="Opens in Blender, online glTF viewers and most 3D tools.">
            <URadioGroup v-model="glb.scope" :items="[{ value: 'all', label: 'Whole building' }, { value: 'active', label: `Active floor only (${activeFloor?.name})` }]" />
          </UFormField>
        </template>
        <template v-else-if="store.ui.export === 'pdf'">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Paper">
              <URadioGroup v-model="pdf.paper" orientation="horizontal" :items="[{ value: 'a4', label: 'A4' }, { value: 'a3', label: 'A3' }]" />
            </UFormField>
            <UFormField label="Orientation">
              <URadioGroup v-model="pdf.orientation" orientation="horizontal" :items="[{ value: 'landscape', label: 'Landscape' }, { value: 'portrait', label: 'Portrait' }]" />
            </UFormField>
            <UFormField label="Scale">
              <URadioGroup v-model="pdf.scale" orientation="horizontal" :items="[{ value: 50, label: '1:50' }, { value: 100, label: '1:100' }, { value: 'fit', label: 'Fit' }]" />
            </UFormField>
            <UFormField label="Floors">
              <URadioGroup v-model="pdf.floors" :items="[{ value: 'active', label: 'Active floor' }, { value: 'all', label: 'All floors (a page each)' }]" />
            </UFormField>
          </div>
          <p class="text-xs text-muted">Print at 100 % (no “fit to page” in the print dialog) for the scale to measure true.</p>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" label="Cancel" @click="store.ui.export = null" />
        <UButton icon="i-lucide-download" label="Export…" :loading="busy" @click="run" />
      </div>
    </template>
  </UModal>
</template>
