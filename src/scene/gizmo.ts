// 3D move gizmo for a single selected item (TransformControls on a proxy). Drags preview into the
// store and commit one undoable command on release. 2D uses the select tool's drag instead.
import * as THREE from 'three'
import { watch } from 'vue'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { store } from '@/editor/store'
import { execute, preview, updateEntity, find } from '@/editor/commands'
import type { Viewport } from './viewport'

export function attachGizmo(vp: Viewport) {
  const tc = new TransformControls(vp.perspCamera, vp.canvas)
  tc.showY = false
  tc.setSize(0.8)
  const helper = tc.getHelper()
  helper.userData.noExport = true
  const proxy = new THREE.Object3D()
  vp.scene.add(helper, proxy)
  let id = ''
  let before: { x: number; y: number } | null = null

  tc.addEventListener('change', vp.requestRender)
  tc.addEventListener('objectChange', () => id && preview('items', id, { x: proxy.position.x, y: -proxy.position.z }))
  tc.addEventListener('dragging-changed', e => {
    const it = find('items', id)
    if (!it) return
    if (e.value) before = { x: it.x, y: it.y }
    else if (before && (before.x !== it.x || before.y !== it.y)) {
      execute(updateEntity('items', id, { x: it.x, y: it.y }, before, 'Move item'))
      before = null
    }
  })
  vp.setGuard(() => tc.dragging || tc.axis !== null) // gizmo handles get the pointer before tools

  function sync() {
    const it = store.selection.length === 1 && store.view === '3d' ? store.data?.items.find(i => i.id === store.selection[0]) : null
    const floor = it && store.data?.floors.find(f => f.id === it.floorId)
    if (!it || !floor || it.floorId !== store.activeFloorId) {
      tc.detach()
      id = ''
    } else {
      id = it.id
      if (!tc.dragging) proxy.position.set(it.x, floor.elevation + it.z, -it.y)
      tc.setTranslationSnap(store.settings.grid || null)
      tc.attach(proxy)
    }
    vp.requestRender()
  }
  const stop = watch(() => [store.view, store.selection, store.data?.items, store.activeFloorId, store.data?.floors], sync, { deep: true, immediate: true })
  return () => {
    stop()
    tc.detach()
    tc.dispose()
    helper.removeFromParent()
  }
}
