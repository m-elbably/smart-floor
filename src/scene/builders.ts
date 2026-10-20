// Entity → Object3D. Objects carry userData { id, kind } for picking. Plan (x, y) → world (x, h, -y).
import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { Floor, Opening, Room, Stair, Vec2, Zone } from '@/types'
import { add, centroid, lerp, norm, scale, sub, wallSegments, dist } from '@/editor/geometry'
import { doorLeaves, swingArc, type WallView } from '@/editor/model'
export { openingFrame } from '@/editor/model'
import { FLOOR_MATERIALS, ZONE_KINDS, POOL_DEPTH } from '@/editor/presets'
import { COLUMN_R, type StairSolution } from '@/editor/stairs'
import { LAYER } from './viewport'

const cache = new Map<string, THREE.Material>()
function mat(key: string, make: () => THREE.Material) {
  let m = cache.get(key)
  if (!m) cache.set(key, (m = make()))
  return m
}
const std = (color: string) => mat(`std${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }))
const WALL_TOP = '#3f3f46'
const SLAB_SIDE = '#9ca3af'
const SYMBOL = '#27272a'
const lineMat = () => mat('symbol', () => new THREE.LineBasicMaterial({ color: SYMBOL }))
const glassMat = () => mat('glass', () => new THREE.MeshStandardMaterial({ color: '#9ec9f5', transparent: true, opacity: 0.35, roughness: 0.1 }))
const pickMat = () => mat('pick', () => new THREE.MeshBasicMaterial())

const v3 = (p: Vec2, y = 0) => new THREE.Vector3(p[0], y, -p[1])
function shape(poly: Vec2[], holes: Vec2[][] = []) {
  const s = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])))
  for (const h of holes) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))))
  return s
}

/** Remove from the scene graph and free GPU buffers and label DOM nodes (materials are shared). */
export function dispose(obj: THREE.Object3D) {
  obj.removeFromParent()
  obj.traverse(o => {
    if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose()
    if (o instanceof CSS2DObject) o.element.remove()
  })
}

/** `holes`: stairwell voids from stairs on the floor below (plan coords). */
export function buildRoom(room: Room, floor: Floor, label: { title: string; sub: string }, holes: Vec2[][] = []) {
  const g = new THREE.Group()
  g.userData = { id: room.id, kind: 'room' }
  const depth = Math.max(floor.slab, 0.02)
  const floorColor = FLOOR_MATERIALS[room.floorMaterial]?.color ?? FLOOR_MATERIALS.wood.color
  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape(room.polygon, holes), { depth, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -depth, 0),
    [std(floorColor), std(SLAB_SIDE)]
  )
  slab.receiveShadow = true
  g.add(slab)

  if (room.ceiling && room.kind !== 'outdoor') {
    const ceil = new THREE.Mesh(
      new THREE.ShapeGeometry(shape(room.polygon, holes)).rotateX(-Math.PI / 2),
      mat('ceiling', () => new THREE.MeshStandardMaterial({ color: '#fafafa', side: THREE.DoubleSide }))
    )
    ceil.position.y = floor.height
    ceil.layers.set(LAYER.ceiling) // walk mode only
    g.add(ceil)
  }

  const el = document.createElement('div')
  el.className = 'room-label'
  el.innerHTML = `<b></b><span></span>`
  el.children[0].textContent = label.title
  el.children[1].textContent = label.sub
  const tag = new CSS2DObject(el)
  tag.position.copy(v3(centroid(room.polygon), 0.05))
  g.add(tag)
  return g
}

export interface PlacedOpening {
  opening: Opening
  wallKey: string
  center: number // along the wall piece
  inward: Vec2 // unit vector into the host room (door swing side "in")
  hingeAtStart: boolean // hinge at the wall piece's lower-t jamb
}

function box(len: number, h: number, t: number, material: THREE.Material | THREE.Material[]) {
  return new THREE.Mesh(new THREE.BoxGeometry(len, h, t), material)
}

/** All walls of one floor (derived room walls + free walls) with their openings cut in. */
export function buildWalls(walls: WallView[], openings: PlacedOpening[]) {
  const g = new THREE.Group()
  for (const w of walls) {
    const L = dist(w.a, w.b)
    if (L < 1e-3) continue
    const dir = norm(sub(w.b, w.a))
    const theta = Math.atan2(dir[1], dir[0])
    const side = std(w.color)
    const materials = [side, side, std(WALL_TOP), side, side, side]
    const mine = openings.filter(o => o.wallKey === w.key)
    const at = (t: number) => add(w.a, scale(dir, t))
    const place = (m: THREE.Object3D, t: number, y: number, layer?: number) => {
      m.position.copy(v3(at(t), y))
      m.rotation.y = theta
      if (layer !== undefined) m.layers.set(layer)
      if (m instanceof THREE.Mesh) m.castShadow = m.receiveShadow = true
      g.add(m)
      return m
    }
    const wallTag = { id: w.ownerId, kind: w.wallId ? 'wall' : 'room' }
    if (w.kind === 'fence') {
      g.add(buildFence(w, L, dir, theta, wallTag))
      continue
    }

    for (const part of wallSegments(L, mine.map(o => ({ id: o.opening.id, center: o.center, width: o.opening.width })))) {
      const len = part.to - part.from
      const mid = (part.from + part.to) / 2
      if (!part.openingId) {
        place(box(len, w.height, w.thickness, materials), mid, w.height / 2).userData = wallTag
        continue
      }
      const po = mine.find(o => o.opening.id === part.openingId)!
      const o = po.opening
      const top = Math.min(w.height, o.sill + o.height)
      // Lintel / sill are 3D-only so the plan view shows the opening gap with its symbol.
      if (w.height - top > 0.01) place(box(len, w.height - top, w.thickness, materials), mid, (w.height + top) / 2, LAYER.model).userData = wallTag
      if (o.sill > 0.01) place(box(len, o.sill, w.thickness, materials), mid, o.sill / 2, LAYER.model).userData = wallTag
      place(box(len, top - o.sill, w.thickness + 0.04, pickMat()), mid, (o.sill + top) / 2, LAYER.pick).userData = { id: o.id, kind: 'opening' }
      const sym = o.kind === 'door' ? doorSymbol(po, w, part.from, part.to, top) : windowSymbol(o, w, part.from, part.to)
      for (const m of sym) g.add(m)
    }
  }
  return g
}

function doorSymbol(po: PlacedOpening, w: WallView, from: number, to: number, top: number): THREE.Object3D[] {
  const o = po.opening
  const dir = norm(sub(w.b, w.a))
  const leaves = doorLeaves(o, w, from, to, po.inward, po.hingeAtStart)
  const out: THREE.Object3D[] = []
  for (const leaf of leaves) {
    const h = leaf.hinge
    const into = leaf.into
    // 2D: quarter arc + leaf line back to the hinge
    const pts = [...swingArc(leaf), h].map(p => v3(p, 0.01))
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat())
    line.layers.set(LAYER.plan)
    out.push(line)
    // Clicking inside the swing selects the door (pick-only, never drawn).
    const swing = box(leaf.width, 0.05, leaf.width, pickMat())
    swing.position.copy(v3(add(h, add(scale(leaf.toward, leaf.width / 2), scale(into, leaf.width / 2))), 0.03))
    swing.rotation.y = Math.atan2(dir[1], dir[0])
    swing.layers.set(LAYER.pick)
    swing.userData = { id: o.id, kind: 'opening' }
    out.push(swing)
    // 3D: leaf standing open at 90°
    const leafMesh = box(0.04, top - 0.01, leaf.width, std('#b08a64'))
    leafMesh.position.copy(v3(add(h, add(scale(into, leaf.width / 2), scale(leaf.toward, 0.02))), (top - 0.01) / 2))
    leafMesh.rotation.y = Math.atan2(dir[1], dir[0])
    leafMesh.layers.set(LAYER.model)
    leafMesh.castShadow = true
    leafMesh.userData = { id: o.id, kind: 'opening' }
    out.push(leafMesh)
  }
  return out
}

function windowSymbol(o: Opening, w: WallView, from: number, to: number): THREE.Object3D[] {
  const dir = norm(sub(w.b, w.a))
  const n: Vec2 = [-dir[1], dir[0]]
  const at = (t: number, off: number) => add(add(w.a, scale(dir, t)), scale(n, off))
  const pts: THREE.Vector3[] = []
  const half = w.thickness / 2
  for (const off of [-half, 0, half]) pts.push(v3(at(from, off), 0.01), v3(at(to, off), 0.01))
  pts.push(v3(at(from, -half), 0.01), v3(at(from, half), 0.01), v3(at(to, -half), 0.01), v3(at(to, half), 0.01))
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat())
  lines.layers.set(LAYER.plan)
  const glass = box(to - from, o.height, 0.02, glassMat())
  glass.position.copy(v3(lerp(at(from, 0), at(to, 0), 0.5), o.sill + o.height / 2))
  glass.rotation.y = Math.atan2(dir[1], dir[0])
  glass.layers.set(LAYER.model)
  glass.userData = { id: o.id, kind: 'opening' }
  return [lines, glass]
}

// ---------- stairs ----------

/** A thin bar between two world points (handrails, posts). */
function bar(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(r, r, a.distanceTo(b)), material)
  m.position.copy(a).lerp(b, 0.5)
  m.lookAt(b)
  m.castShadow = true
  return m
}

export function buildStair(stair: Stair, sol: StairSolution, totalRise: number) {
  const g = new THREE.Group()
  g.userData = { id: stair.id, kind: 'stair' }
  g.position.set(stair.x, 0, -stair.y)
  g.rotation.y = (stair.rotation * Math.PI) / 180
  const wood = std('#c8b08c')
  const spiral = stair.kind === 'spiral'
  for (const tr of sol.treads) {
    // Solid blocks read well for flights; spiral treads float around the column.
    const depth = spiral ? 0.05 : tr.top
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(tr.poly), { depth, bevelEnabled: false }).rotateX(-Math.PI / 2), [wood, std('#a88f6c')])
    m.position.y = tr.top - depth
    m.castShadow = m.receiveShadow = true
    g.add(m)
  }
  if (spiral) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(COLUMN_R, COLUMN_R, totalRise + 0.9, 16), std('#71717a'))
    col.position.y = (totalRise + 0.9) / 2
    g.add(col)
  }

  // Railings: posts every other tread plus a handrail 0.9 m above the nosing line.
  const metal = std('#52525b')
  const sides: Vec2[][] = []
  if (stair.params.railLeft && !spiral) sides.push(sol.treads.map(t => t.left))
  if (stair.params.railRight) sides.push(sol.treads.map(t => t.right))
  for (const pts of sides) {
    const tops = pts.map((p, i) => v3(p, sol.treads[i].top + 0.9))
    for (let i = 0; i < tops.length; i += 2) g.add(bar(v3(pts[i], sol.treads[i].top), tops[i], 0.03, metal))
    g.add(bar(v3(pts.at(-1)!, sol.treads.at(-1)!.top), tops.at(-1)!, 0.03, metal))
    for (let i = 1; i < tops.length; i++) g.add(bar(tops[i - 1], tops[i], 0.045, metal))
  }

  // Plan symbol: tread outlines + walk-line arrow + "UP".
  const segs: THREE.Vector3[] = []
  for (const tr of sol.treads) tr.poly.forEach((p, i) => segs.push(v3(p, totalRise + 0.02), v3(tr.poly[(i + 1) % tr.poly.length], totalRise + 0.02)))
  const w = sol.walk
  for (let i = 1; i < w.length; i++) segs.push(v3(w[i - 1], totalRise + 0.02), v3(w[i], totalRise + 0.02))
  const [a, b] = [w[w.length - 2], w[w.length - 1]]
  const d = sub(b, a)
  const l = Math.hypot(d[0], d[1]) || 1
  const u: Vec2 = [d[0] / l, d[1] / l]
  const back = (s: number): Vec2 => [b[0] - u[0] * 0.25 + -u[1] * s, b[1] - u[1] * 0.25 + u[0] * s]
  segs.push(v3(b, totalRise + 0.02), v3(back(0.12), totalRise + 0.02), v3(b, totalRise + 0.02), v3(back(-0.12), totalRise + 0.02))
  const sym = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), lineMat())
  sym.layers.set(LAYER.plan)
  g.add(sym)
  const el = document.createElement('div')
  el.className = 'room-label stair-label'
  el.textContent = 'UP'
  const tag = new CSS2DObject(el)
  tag.position.copy(v3(w[0], 0.1))
  tag.layers.set(LAYER.plan)
  g.add(tag)
  return g
}

// ---------- fences, zones, site ----------

/** Posts every ~2 m plus two rails; one invisible pick box along the whole run. */
function buildFence(w: WallView, L: number, dir: Vec2, theta: number, tag: object) {
  const g = new THREE.Group()
  const wood = std('#8b6b4a')
  const n = Math.max(1, Math.ceil(L / 2))
  const put = (m: THREE.Mesh, t: number, y: number) => {
    m.position.copy(v3(add(w.a, scale(dir, t)), y))
    m.rotation.y = theta
    m.castShadow = true
    m.userData = tag
    g.add(m)
    return m
  }
  for (let i = 0; i <= n; i++) put(box(0.08, w.height, 0.08, wood), (i / n) * L, w.height / 2)
  for (const y of [0.3, 0.85]) put(box(L, 0.07, w.thickness, wood), L / 2, w.height * y)
  put(box(L, w.height, Math.max(0.2, w.thickness), pickMat()), L / 2, w.height / 2).layers.set(LAYER.pick)
  return g
}

/** Zones sit just under room floors (so a house on the lawn covers it); `holes` are pools cut out of lawns. */
export function buildZone(z: Zone, label: { title: string; sub: string }, holes: Vec2[][] = []) {
  const g = new THREE.Group()
  g.userData = { id: z.id, kind: 'zone' }
  const color = ZONE_KINDS[z.kind]?.color ?? '#7fb069'
  if (z.kind === 'pool') {
    const depth = Number(z.props.depth ?? POOL_DEPTH)
    // Basin: an extruded prism seen from inside (BackSide), plus a water surface just below the rim.
    const basin = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape(z.polygon), { depth, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -depth, 0),
      mat('poolBasin', () => new THREE.MeshStandardMaterial({ color: '#d9eef5', side: THREE.BackSide }))
    )
    basin.receiveShadow = true
    const water = new THREE.Mesh(
      new THREE.ShapeGeometry(shape(z.polygon)).rotateX(-Math.PI / 2),
      mat('water', () => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.7, roughness: 0.05 }))
    )
    water.position.y = -0.12
    const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(z.polygon.map(p => v3(p, -0.006))), mat('rim', () => new THREE.LineBasicMaterial({ color: '#e7e5e4' })))
    g.add(basin, water, rim)
  } else {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape(z.polygon, holes)).rotateX(-Math.PI / 2), std(color))
    m.position.y = z.kind === 'grass' ? -0.012 : -0.008 // paving shows over lawn
    m.receiveShadow = true
    g.add(m)
  }
  const el = document.createElement('div')
  el.className = 'room-label'
  el.innerHTML = '<b></b><span></span>'
  el.children[0].textContent = label.title
  el.children[1].textContent = label.sub
  const tag = new CSS2DObject(el)
  tag.position.copy(v3(centroid(z.polygon), 0.05))
  g.add(tag)
  return g
}

export function buildSite(poly: Vec2[]) {
  const pts = [...poly, poly[0]].map(p => v3(p, 0.015))
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat('site', () => new THREE.LineDashedMaterial({ color: '#f59e0b', dashSize: 0.5, gapSize: 0.3 })))
  line.computeLineDistances()
  return line
}
