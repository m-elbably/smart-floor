// First-person walk mode: pointer-lock mouse look, WASD (+ Shift to run), wall collision with door gaps,
// stairs that carry you between floors. Renders continuously only while walking.
import * as THREE from 'three'
import { watch } from 'vue'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import type { Vec2 } from '@/types'
import { store } from '@/editor/store'
import { floorWalls, hostLine, openingOnWall, stairRise } from '@/editor/model'
import { add, bbox, dist, lerp, norm, rightNormal, scale, sub, wallSegments } from '@/editor/geometry'
import { solve, toPlan } from '@/editor/stairs'
import { collide, onStair, type Blocker, type StairRun } from '@/editor/walkmath'
import type { Viewport } from './viewport'

const EYE = 1.65
const RADIUS = 0.25
const SPEED = { walk: 1.4, run: 3 }
const MOVE: Record<string, Vec2> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0]
}

/** Solid wall pieces of a floor: doors are gaps, windows are not. */
function blockersFor(floorId: string): Blocker[] {
  const data = store.data!
  const walls = floorWalls(data, floorId, store.settings)
  const doors = data.openings.filter(o => o.floorId === floorId && o.kind === 'door')
  const out: Blocker[] = []
  for (const w of walls) {
    const L = dist(w.a, w.b)
    const dir = norm(sub(w.b, w.a))
    const spans = doors.flatMap(o => {
      const on = openingOnWall(data, o, walls)
      return on && on.wall.key === w.key ? [{ id: o.id, center: on.center, width: o.width }] : []
    })
    for (const part of wallSegments(L, spans)) {
      if (part.openingId) continue
      out.push({ a: add(w.a, scale(dir, part.from)), b: add(w.a, scale(dir, part.to)), half: w.thickness / 2 })
    }
  }
  return out
}

function stairRuns(): StairRun[] {
  const data = store.data!
  return data.stairs.flatMap(st => {
    const f = data.floors.find(f => f.id === st.floorId)
    if (!f) return []
    const rise = stairRise(data, st.floorId, store.settings.slab)
    const sol = solve(st.kind, st.params, rise)
    const above = data.floors.find(x => x.level === f.level + 1)
    return [{ footprint: toPlan(st, sol.footprint), walk: toPlan(st, sol.walk), base: f.elevation, rise, lowerFloorId: f.id, upperFloorId: above?.id ?? null }]
  })
}

/** Outside the first exterior door, facing it; otherwise the middle of the floor. */
function startPose(floorId: string): { pos: Vec2; look: Vec2 } {
  const data = store.data!
  const walls = floorWalls(data, floorId, store.settings)
  for (const o of data.openings) {
    if (o.floorId !== floorId || o.kind !== 'door') continue
    const on = openingOnWall(data, o, walls)
    const line = hostLine(data, o.host)
    if (!on || !line || on.wall.wallId || on.wall.hosts.length !== 1) continue
    const c = lerp(line[0], line[1], o.along / (dist(line[0], line[1]) || 1))
    const out = rightNormal(sub(line[1], line[0])) // CCW rooms: right = outside
    return { pos: add(c, scale(out, 1.2)), look: c }
  }
  const pts = data.rooms.filter(r => r.floorId === floorId).flatMap(r => r.polygon)
  if (!pts.length) return { pos: [0, -3], look: [0, 0] }
  const { min, max } = bbox(pts)
  const mid = lerp(min, max, 0.5)
  return { pos: mid, look: [mid[0], mid[1] + 1] }
}

export function attachWalk(vp: Viewport) {
  const cam = vp.perspCamera
  const controls = new PointerLockControls(cam, vp.canvas)
  const keys = new Set<string>()
  let active = false
  let pos: Vec2 = [0, 0]
  let last = 0
  let blockers: { floorId: string; list: Blocker[] } | null = null
  let runs: StairRun[] | null = null

  controls.addEventListener('change', vp.requestRender)
  controls.addEventListener('lock', () => (store.walkLocked = true))
  controls.addEventListener('unlock', () => {
    store.walkLocked = false
    if (active) store.view = '3d' // Esc releases the mouse and leaves walk mode
  })
  const onClick = () => active && !controls.isLocked && controls.lock()
  vp.canvas.addEventListener('click', onClick)

  const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest('input, textarea, [contenteditable]')
  const onDown = (e: KeyboardEvent) => {
    if (!active || typing(e)) return
    if (MOVE[e.code] || e.code.startsWith('Shift')) (keys.add(e.code), e.preventDefault())
  }
  const onUp = (e: KeyboardEvent) => keys.delete(e.code)
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  const onBlur = () => keys.clear()
  window.addEventListener('blur', onBlur)

  function surface(p: Vec2) {
    const data = store.data!
    const hit = onStair(p, (runs ??= stairRuns()))
    if (hit) return hit
    const f = data.floors.find(f => f.id === store.activeFloorId)
    return { z: f?.elevation ?? 0, floorId: store.activeFloorId }
  }

  function place() {
    const s = surface(pos)
    if (s.floorId !== store.activeFloorId) store.activeFloorId = s.floorId // stairs carry you to the other floor
    cam.position.set(pos[0], s.z + EYE, -pos[1])
  }

  function step(now: number) {
    if (!active || !store.data) return false
    const dt = Math.min(0.05, (now - (last || now)) / 1000)
    last = now
    let mx = 0
    let my = 0
    for (const k of keys) if (MOVE[k]) (mx += MOVE[k][0]), (my += MOVE[k][1])
    if (mx || my) {
      const f = cam.getWorldDirection(new THREE.Vector3())
      const fwd = norm([f.x, -f.z])
      const right: Vec2 = [fwd[1], -fwd[0]]
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPEED.run : SPEED.walk
      const d = norm(add(scale(fwd, my), scale(right, mx)))
      const next = add(pos, scale(d, speed * dt))
      if (!blockers || blockers.floorId !== store.activeFloorId) blockers = { floorId: store.activeFloorId, list: blockersFor(store.activeFloorId) }
      pos = collide(next, blockers.list, RADIUS)
      place()
    }
    vp.requestRender()
    return true
  }

  function start() {
    active = true
    blockers = null
    runs = null
    const { pos: p, look } = startPose(store.activeFloorId)
    pos = p
    place()
    cam.lookAt(look[0], cam.position.y, -look[1])
    last = 0
    try {
      controls.lock()
    } catch {
      /* needs a click; the overlay says so */
    }
    vp.animate(step)
  }
  function stop() {
    active = false
    keys.clear()
    if (controls.isLocked) controls.unlock()
  }

  const stopView = watch(
    () => store.view,
    v => (v === 'walk' ? start() : active && stop())
  )
  const stopData = watch(
    () => store.data,
    () => ((blockers = null), (runs = null)),
    { deep: true }
  )
  return () => {
    stop()
    stopView()
    stopData()
    controls.dispose()
    vp.canvas.removeEventListener('click', onClick)
    window.removeEventListener('keydown', onDown)
    window.removeEventListener('keyup', onUp)
    window.removeEventListener('blur', onBlur)
  }
}
