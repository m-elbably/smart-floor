// Room drawing tools: rectangle (drag or click-click), polygon (click vertices), template stamp.
import type { Room, Vec2 } from '@/types'
import { COLORS, type Shape } from '@/scene/overlay'
import { store, activeFloor, notify, type ToolId } from '../store'
import { execute, addEntity } from '../commands'
import { area, centroid, dist, ensureCCW, isSimple, lerp, EPS, norm, sub, add, scale } from '../geometry'
import { format, formatArea } from '../units'
import { TEMPLATES } from '../presets'
import { registerTool, type PlanEvent } from './index'
import { createEntry } from './entry'

const MIN = 0.3

/** "Room 3", or "Bathroom 2" when a Bathroom already exists. */
export function uniqueName(base: string) {
  const names = new Set(store.data!.rooms.map(r => r.name))
  if (base !== 'Room' && !names.has(base)) return base
  for (let i = base === 'Room' ? 1 : 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`
}

export function addRoom(polygon: Vec2[], extra: Partial<Room> = {}) {
  const room: Room = {
    id: crypto.randomUUID(),
    floorId: activeFloor.value!.id,
    name: '',
    kind: 'generic',
    polygon: ensureCCW(polygon),
    floorMaterial: 'wood',
    wallColor: '#f2efe9',
    ceiling: true,
    ...extra
  }
  room.name = uniqueName(extra.name ?? 'Room')
  execute(addEntity('rooms', room, `Add ${room.name}`))
  store.selection = [room.id]
  return room
}

const units = () => store.settings.units
const edgeLabels = (poly: Vec2[], closed: boolean): Shape[] =>
  poly.slice(0, closed ? poly.length : poly.length - 1).map((p, i) => {
    const q = poly[(i + 1) % poly.length]
    return { kind: 'label', at: lerp(p, q, 0.5), text: format(dist(p, q), units()) }
  })

// ---------- rectangle ----------
{
  let start: Vec2 | null = null
  let cur: Vec2 | null = null
  let clickMode = false
  const entry = createEntry()
  const rectOf = (a: Vec2, b: Vec2): Vec2[] => [a, [b[0], a[1]], b, [a[0], b[1]]]

  function finish(end: Vec2) {
    const w = Math.abs(end[0] - start![0])
    const d = Math.abs(end[1] - start![1])
    if (w < MIN || d < MIN) notify(`Rooms must be at least ${format(MIN, units())} wide`)
    else addRoom(rectOf(start!, end))
    cancel()
  }
  function cancel() {
    start = cur = null
    clickMode = false
    entry.clear()
  }

  registerTool({
    id: 'rect',
    down(e) {
      if (start && clickMode) finish(e.p)
      else (start = e.p), (cur = e.p)
      return true
    },
    move(e) {
      cur = e.p
    },
    up(e) {
      if (!start || clickMode) return
      if (e.moved) finish(e.p)
      else clickMode = true // click-click: the next click sets the far corner
    },
    key(e) {
      if (start && entry.key(e)) return true
      if (e.key === 'Escape' && start) return cancel(), true
      if (e.key === 'Enter' && start && cur) {
        const v = entry.values(units())
        if (!v) return entry.clear(), true
        const [w, d = w] = v
        finish([start[0] + Math.sign(cur[0] - start[0] || 1) * w, start[1] + Math.sign(cur[1] - start[1] || 1) * d])
        return true
      }
      return false
    },
    cancel,
    preview() {
      if (!start || !cur) return []
      const poly = rectOf(start, cur)
      const [w, d] = [Math.abs(cur[0] - start[0]), Math.abs(cur[1] - start[1])]
      return [
        { kind: 'fill', points: poly, color: COLORS.draw },
        { kind: 'line', points: poly, closed: true, color: COLORS.draw },
        ...edgeLabels(poly, true).slice(0, 2),
        { kind: 'label', at: centroid(poly), text: entry.text || `${format(w, units())} × ${format(d, units())} · ${formatArea(w * d, units())}` }
      ]
    },
    hint: () => (start ? 'Drag or click the opposite corner · type 4x3 + Enter · Esc cancels' : 'Click or drag to draw a rectangular room')
  })
}

// ---------- polygon (rooms, garden zones, site boundary) ----------
export interface PolygonToolSpec {
  id: ToolId
  /** Called with a simple polygon (not yet oriented). */
  done(poly: Vec2[]): void
  color?: string
  first?: string // hint before the first click
}

export function polygonTool(spec: PolygonToolSpec) {
  let pts: Vec2[] = []
  let cur: Vec2 | null = null
  const entry = createEntry()
  const closeRadius = (ppm: number) => 10 / ppm

  function close() {
    const poly = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > EPS)
    if (poly.length > 2 && dist(poly[0], poly[poly.length - 1]) < EPS) poly.pop()
    if (poly.length < 3) return notify('An outline needs at least 3 corners')
    if (!isSimple(poly)) return notify('The outline crosses itself')
    spec.done(poly)
    cancel()
  }
  function cancel() {
    pts = []
    cur = null
    entry.clear()
  }

  const color = spec.color ?? COLORS.draw
  registerTool({
    id: spec.id,
    snapFrom: () => pts.at(-1) ?? null,
    move(e) {
      cur = e.p
    },
    up(e: PlanEvent) {
      if (e.moved) return // an orbit drag in 3D, not a click
      if (pts.length > 2 && dist(e.p, pts[0]) < closeRadius(e.ppm)) return close()
      pts.push(e.p)
    },
    dblclick() {
      if (pts.length > 2) close()
    },
    key(e) {
      if (pts.length && entry.key(e)) return true
      if (e.key === 'Escape' && pts.length) return cancel(), true
      if (e.key === 'Backspace' && pts.length) return pts.pop(), true
      if (e.key === 'Enter' && pts.length) {
        const v = entry.values(units())
        if (entry.text && v && cur) {
          const last = pts[pts.length - 1]
          pts.push(add(last, scale(norm(sub(cur, last)), v[0])))
          entry.clear()
        } else close()
        return true
      }
      return false
    },
    cancel,
    preview() {
      if (!pts.length) return []
      const chain = cur ? [...pts, cur] : pts
      const shapes: Shape[] = [
        { kind: 'line', points: chain, color },
        { kind: 'dots', points: pts, color, size: 7 },
        ...edgeLabels(chain, false)
      ]
      if (chain.length > 2) {
        shapes.push({ kind: 'fill', points: chain, color })
        shapes.push({ kind: 'line', points: [chain[chain.length - 1], chain[0]], color, width: 1, dashed: true })
        shapes.push({ kind: 'label', at: centroid(chain), text: formatArea(area(chain), units()) })
      }
      if (entry.text && cur) shapes.push({ kind: 'label', at: cur, text: `${entry.text} ↵` })
      return shapes
    },
    hint: () =>
      pts.length
        ? 'Click to add corners · click the first corner or Enter to finish · Backspace undoes a corner · type a length + Enter'
        : (spec.first ?? 'Click to place the first corner')
  })
}

polygonTool({ id: 'polygon', done: poly => addRoom(poly) })

// ---------- template stamp ----------
{
  let cur: Vec2 | null = null
  let turns = 0
  const shape = (): Vec2[] => {
    const t = TEMPLATES[store.toolOptions.template] ?? TEMPLATES.rect
    return t.polygon.map(([x, y]) => {
      let p: Vec2 = [x, y]
      for (let i = 0; i < turns; i++) p = [-p[1], p[0]]
      return [p[0] + cur![0], p[1] + cur![1]] as Vec2
    })
  }
  registerTool({
    id: 'template',
    snaps: () => true,
    move(e) {
      cur = e.p
    },
    up(e) {
      if (e.moved || !cur) return
      const t = TEMPLATES[store.toolOptions.template] ?? TEMPLATES.rect
      addRoom(shape(), { name: t.name, kind: t.kind, floorMaterial: t.floorMaterial })
    },
    key(e) {
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) return (turns = (turns + 1) % 4), true
      return false
    },
    cancel() {
      cur = null
    },
    preview() {
      if (!cur) return []
      const poly = shape()
      const t = TEMPLATES[store.toolOptions.template] ?? TEMPLATES.rect
      return [
        { kind: 'fill', points: poly, color: COLORS.draw },
        { kind: 'line', points: poly, closed: true, color: COLORS.draw, dashed: true },
        { kind: 'label', at: centroid(poly), text: `${t.name} · ${formatArea(area(poly), units())}` }
      ]
    },
    hint: () => 'Click to place · R rotates'
  })
}
