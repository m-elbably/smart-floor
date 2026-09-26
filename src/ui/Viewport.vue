<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { store } from '@/editor/store'
import { createViewport, type Viewport } from '@/scene/viewport'
import { createOverlay } from '@/scene/overlay'
import { attachScene } from '@/scene/sync'
import { attachTools, onPointer } from '@/editor/tools'
import '@/editor/tools/select'
import '@/editor/tools/room'
import '@/editor/tools/wall'
import '@/editor/tools/opening'
import '@/editor/tools/stair'
import { handleKey } from '@/editor/shortcuts'

const el = ref<HTMLElement>()
let vp: Viewport | null = null
let detach: (() => void)[] = []
defineExpose({ preset: (p: Parameters<Viewport['preset']>[0]) => vp?.preset(p) })

// Keys act unless the user is typing or inside a modal/menu.
const free = (e: KeyboardEvent) => !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]')
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }

function onKeyDown(e: KeyboardEvent) {
  if (!vp || !free(e)) return
  if (e.code === 'Space' && !(e.target as HTMLElement).closest('button, a')) {
    e.preventDefault()
    vp.setSpace(true)
  } else if (ARROWS[e.key] && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    vp.pan(...ARROWS[e.key])
  } else if (handleKey(e)) e.preventDefault()
}
const onKeyUp = (e: KeyboardEvent) => e.code === 'Space' && vp?.setSpace(false)

onMounted(() => {
  const v = (vp = createViewport(el.value!, onPointer))
  const overlay = createOverlay(v)
  detach = [attachScene(v), attachTools(v, overlay)]
  if (import.meta.env.DEV) Object.assign((window as any).sf ?? {}, { vp: v })
  watchEffect(() => v.setFloors(store.data?.floors ?? [], store.activeFloorId, store.floorVisibility))
  watch(() => store.view, view => v.setView(view), { immediate: true })
  watch(() => store.dark, d => v.setTheme(d), { immediate: true })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
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
  <div ref="el" class="relative size-full overflow-hidden" :class="store.tool !== 'select' && 'cursor-crosshair'" />
</template>
