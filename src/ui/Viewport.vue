<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { store, setThumbnailer, maybeCaptureThumbnail } from '@/editor/store'
import { createViewport, type Viewport } from '@/scene/viewport'
import { createOverlay } from '@/scene/overlay'
import { attachScene } from '@/scene/sync'
import { attachGizmo } from '@/scene/gizmo'
import { attachWalk } from '@/scene/walk'
import { attachTools, onPointer } from '@/editor/tools'
import '@/editor/tools/select'
import '@/editor/tools/room'
import '@/editor/tools/wall'
import '@/editor/tools/opening'
import '@/editor/tools/stair'
import '@/editor/tools/zone'
import '@/editor/tools/item'
import '@/editor/tools/measure'
import { handleKey } from '@/editor/shortcuts'

const el = ref<HTMLElement>()
const noWebGL = ref(false)
let vp: Viewport | null = null
let detach: (() => void)[] = []
defineExpose({
  preset: (p: Parameters<Viewport['preset']>[0]) => vp?.preset(p),
  snapshot: (scale: number) => vp!.snapshot(scale),
  exportGlb: (activeOnly: boolean) => vp!.exportGlb(activeOnly)
})

// Keys act unless the user is typing or inside a modal/menu.
const free = (e: KeyboardEvent) => !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]')
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }

function onKeyDown(e: KeyboardEvent) {
  if (!vp || !free(e)) return
  if (store.view === 'walk') {
    // walk.ts owns movement keys; only view switching and Esc get through
    if (e.key === 'Tab' || e.key === 'Escape') (e.preventDefault(), handleKey(e))
    return
  }
  if (e.code === 'Space' && !(e.target as HTMLElement).closest('button, a')) {
    e.preventDefault()
    vp.setSpace(true)
  } else if (handleKey(e)) e.preventDefault() // arrows nudge a selection…
  else if (ARROWS[e.key] && !e.ctrlKey && !e.metaKey) {
    e.preventDefault() // …otherwise they pan
    vp.pan(...ARROWS[e.key])
  }
}
const onKeyUp = (e: KeyboardEvent) => e.code === 'Space' && vp?.setSpace(false)

onMounted(() => {
  try {
    vp = createViewport(el.value!, onPointer)
  } catch (e) {
    console.error(e) // no WebGL (e.g. GPU acceleration off in the system webview): say so instead of a blank editor
    noWebGL.value = true
    return
  }
  const v = vp
  const overlay = createOverlay(v)
  detach = [attachScene(v), attachTools(v, overlay), attachGizmo(v), attachWalk(v)]
  setThumbnailer(() => v.thumbnail())
  const timer = setInterval(maybeCaptureThumbnail, 15_000)
  detach.push(() => (clearInterval(timer), setThumbnailer(null)))
  if (import.meta.env.DEV) Object.assign((window as any).sf ?? {}, { vp: v })
  // Walking shows the whole building (the floor above is your ceiling, the stairwell shows the one below).
  watchEffect(() => v.setFloors(store.data?.floors ?? [], store.activeFloorId, store.view === 'walk' ? 'all' : store.floorVisibility))
  watch(() => store.view, view => v.setView(view), { immediate: true })
  watch(() => store.ui.fit, () => v.fit())
  watch(() => store.dark, d => v.setTheme(d), { immediate: true })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // Drag from the catalog: the item tool previews on dragover and places on drop.
  el.value!.addEventListener('dragover', e => {
    if (store.tool !== 'item') return
    e.preventDefault()
    onPointer('move', e, v.planAt(e.offsetX, e.offsetY))
  })
  el.value!.addEventListener('drop', e => {
    if (store.tool !== 'item') return
    e.preventDefault()
    onPointer('up', e, v.planAt(e.offsetX, e.offsetY))
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  detach.forEach(d => d())
  vp?.dispose()
  store.cursor = null
})
</script>

<template>
  <div
    ref="el"
    class="relative size-full overflow-hidden"
    :class="store.tool !== 'select' && 'cursor-crosshair'"
    role="application"
    aria-label="Floor plan editor. Press question mark for keyboard shortcuts, Control K for all actions."
  >
    <div v-if="noWebGL" class="absolute inset-0 grid place-items-center p-8 text-center">
      <div class="max-w-md space-y-2">
        <p class="font-medium">3D graphics are not available</p>
        <p class="text-sm text-muted">Smart Floor needs WebGL. Enable hardware acceleration for your system's web view, or update your graphics drivers, then restart the app.</p>
      </div>
    </div>
  </div>
</template>
