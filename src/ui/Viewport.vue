<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { store } from '@/editor/store'
import { createViewport, type Viewport } from '@/scene/viewport'

const el = ref<HTMLElement>()
let vp: Viewport | null = null
defineExpose({ preset: (p: Parameters<Viewport['preset']>[0]) => vp?.preset(p) })

// Keys act unless the user is typing or inside a modal/menu.
const free = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  return !e.ctrlKey && !e.metaKey && !e.altKey && !t.closest('input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]')
}
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }

function onKeyDown(e: KeyboardEvent) {
  if (!vp || !free(e)) return
  if (e.code === 'Space' && !(e.target as HTMLElement).closest('button, a')) {
    e.preventDefault()
    vp.setSpace(true)
  } else if (e.key === 'Tab') {
    e.preventDefault()
    store.view = store.view === '2d' ? '3d' : '2d' // [FR-83]
  } else if (ARROWS[e.key]) {
    e.preventDefault()
    vp.pan(...ARROWS[e.key])
  }
}
const onKeyUp = (e: KeyboardEvent) => e.code === 'Space' && vp?.setSpace(false)

onMounted(() => {
  const v = (vp = createViewport(el.value!, p => (store.cursor = p)))
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
  vp?.dispose()
  store.cursor = null
})
</script>

<template>
  <div ref="el" class="relative size-full overflow-hidden" />
</template>
