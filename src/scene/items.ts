// Furniture on one floor, instanced: items sharing catalogId + variant share one InstancedMesh per
// model part. Each InstancedMesh carries userData.ids[instanceId] → item id for picking.
import * as THREE from 'three'
import type { Item } from '@/types'
import { catalogItem, buildModel } from '@/catalog'

export function itemMatrix(it: Item, floorHeight: number, out = new THREE.Matrix4()) {
  const def = catalogItem(it.catalogId)
  const s = it.scale[0] || 1
  // Ceiling items hang from the ceiling: z is the gap between their top and the ceiling.
  const y = def?.placement === 'ceiling' ? floorHeight - def.size[2] * s - it.z : it.z
  return out.compose(
    new THREE.Vector3(it.x, y, -it.y),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (it.rotation * Math.PI) / 180),
    new THREE.Vector3(s, s, s)
  )
}

export function buildItems(items: Item[], floorHeight: number) {
  const root = new THREE.Group()
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    const key = `${it.catalogId}|${it.variant ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), it])
  }
  const m = new THREE.Matrix4()
  for (const list of groups.values()) {
    const def = catalogItem(list[0].catalogId)
    if (!def) continue
    const proto = buildModel(def, list[0].variant)
    proto.updateMatrixWorld(true)
    proto.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length)
      list.forEach((it, i) => im.setMatrixAt(i, itemMatrix(it, floorHeight, m).multiply(mesh.matrixWorld)))
      im.castShadow = im.receiveShadow = true
      im.userData = { ids: list.map(it => it.id), kind: 'item' }
      im.computeBoundingSphere()
      root.add(im)
    })
  }
  return root
}
