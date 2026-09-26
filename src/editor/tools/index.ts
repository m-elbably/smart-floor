// Tool interface + manager. The viewport forwards pointer events here; the manager snaps, picks,
// dispatches to the active tool and redraws the overlay (tool preview + selection + snap guides).
import { watch } from 'vue'
import type { Vec2 } from '@/types'
import type { Viewport, PointerKind } from '@/scene/viewport'
import { COLORS, type Overlay, type Shape } from '@/scene/overlay'
import { store, activeFloor, type ToolId } from '../store'
import { snap, type SnapHit } from '../snapping'
import { snapTargets, floorWalls, openingOnWall, hostLine } from '../model'
import { format } from '../units'
import { add, norm, scale, sub, dist, lerp, rightNormal } from '../geometry'
import type { Opening } from '@/types'
import { stairShapes } from './shapes'
import { itemFootprint } from '@/catalog'

export interface Hit {
  id: string
  kind: string
}

export interface PlanEvent {
  p: Vec2 // snapped
  raw: Vec2
  snap: SnapHit
  hit: Hit | null
  shift: boolean
  alt: boolean
  ctrl: boolean
  /** Screen pixels per metre here. */
  ppm: number
  /** On 'up': the pointer travelled more than a few pixels since 'down'. */
  moved: boolean
}

export interface Tool {
  id: ToolId
  /** true = claim the drag (orbit pauses in 3D). */
  down?(e: PlanEvent): boolean | void
  move?(e: PlanEvent): void
  up?(e: PlanEvent): void
  dblclick?(e: PlanEvent): void
  /** Return true when the key was handled. */
  key?(e: KeyboardEvent): boolean
  preview?(): Shape[]
  cancel?(): void
  /** Snapping on for this event? Default true. */
  snaps?(): boolean
  snapFrom?(): Vec2 | null
  snapSkip?(): { roomId: string; vertex: number } | undefined
  hint?(): string
}

const registry = new Map<ToolId, Tool>()
export const registerTool = (t: Tool) => registry.set(t.id, t)
const current = () => registry.get(store.tool)!

let vp: Viewport | null = null
let overlay: Overlay | null = null
let last: PlanEvent | null = null
let downAt: [number, number] | null = null
let lastPulse = ''

export function setTool(id: ToolId) {
  current()?.cancel?.()
  store.tool = id
  refresh()
}

/** Cancel the active tool's in-progress gesture (floor change, project close, Esc). */
export function cancelTool() {
  current()?.cancel?.()
  refresh()
}

export function lastEvent() {
  return last
}

export function attachTools(v: Viewport, o: Overlay) {
  vp = v
  overlay = o
  const stop = watch(() => [store.selection, store.hover, store.data, store.activeFloorId, store.settings.units, store.showDims], refresh, { deep: true })
  const stopFloor = watch(
    () => store.activeFloorId,
    () => {
      cancelTool()
      store.selection = []
    }
  )
  return () => {
    stop()
    stopFloor()
    vp = overlay = null
  }
}

export function onPointer(kind: PointerKind, e: MouseEvent, raw: Vec2 | null): boolean {
  if (!vp || !store.data || !activeFloor.value) return false
  if (kind === 'leave' || !raw) {
    store.cursor = null
    store.hover = null
    return false
  }
  const tool = current()
  const ppm = vp.ppm()
  const hit = vp.pick(e.offsetX, e.offsetY)
  const s: SnapHit =
    e.altKey || tool.snaps?.() === false
      ? { kind: null, point: raw, guides: [] }
      : snap(raw, { ...snapTargets(store.data, activeFloor.value.id, tool.snapSkip?.()), ppm, grid: store.settings.grid, prev: tool.snapFrom?.() })
  if (kind === 'down') downAt = [e.clientX, e.clientY]
  const moved = !!downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4
  const ev: PlanEvent = { p: s.point, raw, snap: s, hit, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, ppm, moved }
  last = ev
  store.cursor = ev.p
  store.snapKind = s.kind
  store.hover = hit?.id ?? null

  let claimed = false
  if (kind === 'down') claimed = !!tool.down?.(ev)
  else if (kind === 'move') tool.move?.(ev)
  else if (kind === 'up') {
    tool.up?.(ev)
    downAt = null
  } else if (kind === 'dblclick') tool.dblclick?.(ev)

  const key = s.kind && s.kind !== 'grid' ? `${s.kind}${s.point.map(v => v.toFixed(3))}` : ''
  if (key && key !== lastPulse) overlay?.pulse(s.point)
  lastPulse = key
  refresh()
  return claimed
}

export function onToolKey(e: KeyboardEvent): boolean {
  const handled = !!current()?.key?.(e)
  if (handled) refresh()
  return handled
}

// ---------- overlay ----------

/** Footprint rectangle of an opening across its wall. */
export function openingFootprint(o: Pick<Opening, 'host' | 'along' | 'width'>, thickness?: number): Vec2[] | null {
  if (!store.data || !activeFloor.value) return null
  const walls = floorWalls(store.data, activeFloor.value.id, store.settings)
  const on = openingOnWall(store.data, o, walls)
  if (!on) return null
  const d = norm(sub(on.wall.b, on.wall.a))
  const n: Vec2 = [-d[1], d[0]]
  const t = (thickness ?? on.wall.thickness) / 2 + 0.02
  const c = add(on.wall.a, scale(d, on.center))
  const h = scale(d, o.width / 2)
  return [add(sub(c, h), scale(n, -t)), add(add(c, h), scale(n, -t)), add(add(c, h), scale(n, t)), add(sub(c, h), scale(n, t))]
}

function outline(id: string, color: string, width: number): Shape[] {
  const data = store.data!
  const room = data.rooms.find(r => r.id === id)
  if (room) return [{ kind: 'line', points: room.polygon, closed: true, color, width }]
  const o = data.openings.find(o => o.id === id)
  if (o) {
    const fp = openingFootprint(o)
    return fp ? [{ kind: 'line', points: fp, closed: true, color, width }] : []
  }
  const s = data.stairs.find(s => s.id === id)
  if (s) return stairShapes(s, color, width)
  const z = data.zones.find(z => z.id === id)
  if (z) return [{ kind: 'line', points: z.polygon, closed: true, color, width }]
  const it = data.items.find(i => i.id === id)
  if (it) return [{ kind: 'line', points: itemFootprint(it), closed: true, color, width }]
  const w = data.walls.find(w => w.id === id)
  if (w) {
    const d = norm(sub(w.b, w.a))
    const n = scale([-d[1], d[0]], w.thickness / 2 + 0.02)
    return [{ kind: 'line', points: [add(w.a, n), add(w.b, n), sub(w.b, n), sub(w.a, n)], closed: true, color, width }]
  }
  return []
}

/** Dimension lines along the outside of every exterior wall on the active floor (FR-72). */
function wallDims(): Shape[] {
  const data = store.data!
  const out: Shape[] = []
  for (const w of floorWalls(data, activeFloor.value!.id, store.settings)) {
    if (w.wallId || w.hosts.length !== 1) continue // exterior room walls only
    const line = hostLine(data, w.hosts[0])
    if (!line) continue
    const n = rightNormal(sub(line[1], line[0])) // outward
    const off = (k: number) => scale(n, w.thickness / 2 + k)
    const [a, b] = [add(w.a, off(0.45)), add(w.b, off(0.45))]
    out.push(
      { kind: 'line', points: [a, b], color: '#71717a', width: 1 },
      { kind: 'line', points: [add(w.a, off(0.05)), add(w.a, off(0.55))], color: '#71717a', width: 1 },
      { kind: 'line', points: [add(w.b, off(0.05)), add(w.b, off(0.55))], color: '#71717a', width: 1 },
      { kind: 'label', at: add(lerp(a, b, 0.5), scale(n, 0.05)), text: format(dist(w.a, w.b), store.settings.units) }
    )
  }
  return out
}

export function refresh() {
  if (!overlay || !store.data) return
  const shapes: Shape[] = []
  if (store.showDims && activeFloor.value) shapes.push(...wallDims())
  const site = store.data.project.site
  if (site && store.tool === 'site') shapes.push({ kind: 'line', points: site, closed: true, color: '#f59e0b', width: 1, dashed: true })
  if (store.hover && !store.selection.includes(store.hover) && store.tool === 'select') shapes.push(...outline(store.hover, COLORS.hover, 1.5))
  for (const id of store.selection) shapes.push(...outline(id, COLORS.primary, 2.5))
  shapes.push(...(current()?.preview?.() ?? []))
  if (last) for (const [a, b] of last.snap.guides) shapes.push({ kind: 'line', points: [a, b], color: COLORS.guide, width: 1, dashed: true })
  store.hint = current()?.hint?.() ?? ''
  overlay.set(shapes)
}
