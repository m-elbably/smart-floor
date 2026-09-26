// Entity → Object3D. Objects carry userData { id, kind } for picking. Plan (x, y) → world (x, h, -y).
import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { Floor, Opening, Room, Stair, Vec2 } from '@/types'
import { add, centroid, dot, lerp, norm, scale, sub, wallSegments, dist } from '@/editor/geometry'
import type { WallView } from '@/editor/model'
import { FLOOR_MATERIALS } from '@/editor/presets'
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

  if (room.ceiling) {
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
  if (o.preset === 'opening') return []
  const dir = norm(sub(w.b, w.a))
  const at = (t: number) => add(w.a, scale(dir, t))
  const swingIn = (o.props.swing ?? 'in') === 'in'
  const into = swingIn ? po.inward : scale(po.inward, -1)
  const face = (p: Vec2) => add(p, scale(into, w.thickness / 2))
  const leaves: { hinge: Vec2; toward: Vec2; width: number }[] = []
  const width = to - from
  if (o.preset === 'double') {
    leaves.push({ hinge: at(from), toward: dir, width: width / 2 }, { hinge: at(to), toward: scale(dir, -1), width: width / 2 })
  } else {
    const hingeStart = po.hingeAtStart === ((o.props.hinge ?? 'left') === 'left')
    leaves.push(hingeStart ? { hinge: at(from), toward: dir, width } : { hinge: at(to), toward: scale(dir, -1), width })
  }
  const out: THREE.Object3D[] = []
  for (const leaf of leaves) {
    const h = face(leaf.hinge)
    // 2D: leaf line + quarter arc
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2)
      pts.push(v3(add(h, add(scale(leaf.toward, Math.cos(a) * leaf.width), scale(into, Math.sin(a) * leaf.width))), 0.01))
    }
    pts.push(v3(h, 0.01))
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

/** Which side of a wall is "inside" for an opening, and whether its host edge runs the same way as the wall piece. */
export function openingFrame(hostA: Vec2, hostB: Vec2, w: WallView) {
  const d = norm(sub(hostB, hostA))
  return { inward: [-d[1], d[0]] as Vec2, hingeAtStart: dot(d, sub(w.b, w.a)) > 0 }
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
