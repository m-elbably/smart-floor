import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import * as THREE from 'three'
import { CATALOG, CATEGORIES } from './manifest'
import { buildProcedural } from './procedural'

assert.ok(CATALOG.length >= 30, `FR-64 wants ≥ 30 items, have ${CATALOG.length}`)
assert.equal(new Set(CATALOG.map(i => i.id)).size, CATALOG.length, 'ids are unique')
for (const c of CATEGORIES) assert.ok(CATALOG.some(i => i.category === c.id), `category ${c.id} has items`)
for (const i of CATALOG) {
  assert.ok(i.size.every(v => v > 0), `${i.id}: positive size`)
  if (i.model.type === 'glb') {
    assert.ok(existsSync(`public/${i.model.url.replace(/^\.?\//, '')}`), `${i.id}: ${i.model.url} exists in public/`)
    continue
  }
  const g = buildProcedural(i.model.builder, i.size, i.variants?.[0]?.colors ?? {}, i.model.params)
  let meshes = 0
  g.traverse(o => (meshes += (o as THREE.Mesh).isMesh ? 1 : 0))
  assert.ok(meshes > 0, `${i.id}: builder "${i.model.builder}" makes meshes`)
  // Bounding box roughly matches the declared size (tables with chairs may overhang).
  const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3())
  assert.ok(size.y <= i.size[2] * 1.2 + 0.25, `${i.id}: height ${size.y.toFixed(2)} ≈ ${i.size[2]}`)
  assert.ok(g.children.length && size.x <= i.size[0] * 1.3 + 0.3, `${i.id}: width ${size.x.toFixed(2)} ≈ ${i.size[0]}`)
}
console.log(`catalog ok (${CATALOG.length} items)`)
