// Select tool: click / Shift+click / box select; drag to move; with one room or zone selected, drag its
// vertices or edges, double-click an edge to add a vertex, double-click a vertex to delete it.
// Drags preview straight into the store and commit one command on release.
import type { Item, Opening, Room, Stair, Vec2, Wall, Zone } from '@/types'
import { COLORS, type Shape } from '@/scene/overlay'
import { store, notify } from '../store'
import { execute, batch, preview, updateEntity, removeEntity, find, type Command } from '../commands'
import { add, sub, dot, scale, dist, edges, isSimple, projectOnSegment, segDistance, bbox, norm, lerp } from '../geometry'
import { refitOpenings, openingPoint, stairRise } from '../model'
import { solve, toPlan } from '../stairs'
import { format } from '../units'
import { registerTool, type PlanEvent } from './index'
import { placeOpening } from './opening'

type Drag =
  | { type: 'move'; start: Vec2; rooms: Room[]; walls: Wall[]; stairs: Stair[]; zones: Zone[]; items: Item[]; delta: Vec2 }
  | { type: 'vertex'; room: Shaped; index: number }
  | { type: 'edge'; room: Shaped; index: number; start: Vec2 }
  | { type: 'opening'; orig: Opening }
  | { type: 'box'; start: Vec2; end: Vec2; screenBox: boolean }

let drag: Drag | null = null
/** What was under the pointer on 'down'. A click decides on this, not on a re-pick at 'up': selecting opens
 *  the inspector, the viewport narrows, and the object may no longer be under the cursor by then. */
let downHit: PlanEvent['hit'] = null
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const grid = () => store.settings.grid
const snapDelta = (d: Vec2, free: boolean): Vec2 => (free || !grid() ? d : [Math.round(d[0] / grid()) * grid(), Math.round(d[1] / grid()) * grid()])

/** Something with an editable outline: a room or a garden zone. */
type Shaped = { t: 'rooms' | 'zones'; id: string; polygon: Vec2[] }

function selectedRoom(): Shaped | null {
  if (store.selection.length !== 1) return null
  const id = store.selection[0]
  const r = store.data!.rooms.find(r => r.id === id)
  if (r) return { t: 'rooms', id, polygon: r.polygon }
  const z = store.data!.zones.find(z => z.id === id)
  return z ? { t: 'zones', id, polygon: z.polygon } : null
}

/** Vertex or edge of the single selected room under the cursor. */
function handleAt(p: Vec2, ppm: number) {
  const room = selectedRoom()
  if (!room) return null
  const vi = room.polygon.findIndex(v => dist(v, p) < 9 / ppm)
  if (vi >= 0) return { room, vertex: vi }
  const ei = edges(room.polygon).findIndex(([a, b]) => segDistance(p, a, b) < 6 / ppm)
  if (ei >= 0) return { room, edge: ei }
  return null
}

/** Polygon change + its openings refit (moved along, re-hosted, or removed) as one command. */
function polygonCommand(room: Shaped, poly: Vec2[], oldPoly: Vec2[], label: string): Command | null {
  if (!isSimple(poly)) {
    notify('That would make the outline cross itself')
    return null
  }
  const cmds: Command[] = [updateEntity(room.t, room.id, { polygon: poly }, { polygon: oldPoly }, label)]
  const removed: string[] = []
  const refits = room.t === 'rooms' ? refitOpenings(store.data!, find('rooms', room.id)!, poly, oldPoly) : []
  for (const r of refits) {
    if (r.patch) cmds.push(updateEntity('openings', r.opening.id, r.patch))
    else (cmds.push(removeEntity('openings', r.opening.id)), removed.push(r.opening.kind))
  }
  if (removed.length) notify(`Removed ${removed.length} opening${removed.length > 1 ? 's' : ''} that no longer fit${' — undo restores'}`)
  return cmds.length === 1 ? cmds[0] : batch(label, cmds)
}

/** Move every movable selected entity by `d` (openings ride along with their hosts). */
function translateSelection(d: Vec2, label: string): Command | null {
  const data = store.data!
  const sel = (id: string) => store.selection.includes(id)
  const cmds: Command[] = [
    ...data.rooms.filter(r => sel(r.id)).map(r => updateEntity('rooms', r.id, { polygon: r.polygon.map(p => add(p, d)) })),
    ...data.zones.filter(z => sel(z.id)).map(z => updateEntity('zones', z.id, { polygon: z.polygon.map(p => add(p, d)) })),
    ...data.walls.filter(w => sel(w.id)).map(w => updateEntity('walls', w.id, { a: add(w.a, d), b: add(w.b, d) })),
    ...data.stairs.filter(s => sel(s.id)).map(s => updateEntity('stairs', s.id, { x: s.x + d[0], y: s.y + d[1] })),
    ...data.items.filter(i => sel(i.id)).map(i => updateEntity('items', i.id, { x: i.x + d[0], y: i.y + d[1] }))
  ]
  return cmds.length ? batch(label, cmds) : null
}

function cancelDrag() {
  if (!drag) return
  if (drag.type === 'move') {
    for (const r of drag.rooms) preview('rooms', r.id, { polygon: r.polygon })
    for (const w of drag.walls) preview('walls', w.id, { a: w.a, b: w.b })
    for (const s of drag.stairs) preview('stairs', s.id, { x: s.x, y: s.y })
    for (const z of drag.zones) preview('zones', z.id, { polygon: z.polygon })
    for (const it of drag.items) preview('items', it.id, { x: it.x, y: it.y })
  } else if (drag.type === 'vertex' || drag.type === 'edge') preview(drag.room.t, drag.room.id, { polygon: drag.room.polygon })
  else if (drag.type === 'opening') preview('openings', drag.orig.id, { host: drag.orig.host, along: drag.orig.along })
  drag = null
}

function inBox(id: string, lo: Vec2, hi: Vec2) {
  const inside = (p: Vec2) => p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1]
  const d = store.data!
  const r = d.rooms.find(r => r.id === id)
  if (r) return r.polygon.every(inside)
  const w = d.walls.find(w => w.id === id)
  if (w) return inside(w.a) && inside(w.b)
  const z = d.zones.find(z => z.id === id)
  if (z) return z.polygon.every(inside)
  const it = d.items.find(i => i.id === id)
  if (it) return inside([it.x, it.y])
  const s = d.stairs.find(s => s.id === id)
  if (s) return toPlan(s, solve(s.kind, s.params, stairRise(d, s.floorId, store.settings.slab)).footprint).every(inside)
  const o = d.openings.find(o => o.id === id)
  const c = o && openingPoint(d, o)
  return !!c && inside(c)
}

registerTool({
  id: 'select',
  snaps: () => drag?.type === 'vertex',
  snapSkip: () => (drag?.type === 'vertex' ? { roomId: drag.room.id, vertex: drag.index } : undefined),
  down(e) {
    downHit = e.hit
    // Priority: corner handle > door/window > wall handle > whatever is under the cursor.
    const h = handleAt(e.raw, e.ppm)
    if (h && 'vertex' in h) return (drag = { type: 'vertex', room: clone(h.room), index: h.vertex! }), true
    if (h && 'edge' in h && e.hit?.kind !== 'opening') return (drag = { type: 'edge', room: clone(h.room), index: h.edge!, start: e.raw }), true
    if (e.hit) {
      if (!store.selection.includes(e.hit.id) && !e.shift) store.selection = [e.hit.id]
      if (e.hit.kind === 'opening') {
        drag = { type: 'opening', orig: clone(find('openings', e.hit.id)!) }
        return true
      }
      const ids = store.selection.includes(e.hit.id) ? store.selection : [e.hit.id]
      const d = store.data!
      drag = {
        type: 'move',
        start: e.raw,
        delta: [0, 0],
        rooms: clone(d.rooms.filter(r => ids.includes(r.id))),
        walls: clone(d.walls.filter(w => ids.includes(w.id))),
        stairs: clone(d.stairs.filter(s => ids.includes(s.id))),
        zones: clone(d.zones.filter(z => ids.includes(z.id))),
        items: clone(d.items.filter(i => ids.includes(i.id)))
      }
      return true
    }
    if (store.view === '2d') return (drag = { type: 'box', start: e.raw, end: e.raw, screenBox: true }), true
    return false // 3D: let the orbit rotate; a plain click clears the selection on 'up'
  },
  move(e) {
    if (!drag) return
    if (drag.type === 'box') drag.end = e.raw
    else if (drag.type === 'move') {
      const d = (drag.delta = snapDelta(sub(e.raw, drag.start), e.alt))
      for (const r of drag.rooms) preview('rooms', r.id, { polygon: r.polygon.map(p => add(p, d)) })
      for (const w of drag.walls) preview('walls', w.id, { a: add(w.a, d), b: add(w.b, d) })
      for (const s of drag.stairs) preview('stairs', s.id, { x: s.x + d[0], y: s.y + d[1] })
      for (const z of drag.zones) preview('zones', z.id, { polygon: z.polygon.map(p => add(p, d)) })
      for (const it of drag.items) preview('items', it.id, { x: it.x + d[0], y: it.y + d[1] })
    } else if (drag.type === 'vertex') {
      const poly = clone(drag.room.polygon)
      poly[drag.index] = e.p
      preview(drag.room.t, drag.room.id, { polygon: poly })
    } else if (drag.type === 'edge') {
      const [a, b] = edges(drag.room.polygon)[drag.index]
      const n = norm([b[1] - a[1], a[0] - b[0]])
      let off = dot(sub(e.raw, drag.start), n)
      if (!e.alt && grid()) off = Math.round(off / grid()) * grid()
      const poly = clone(drag.room.polygon)
      const j = (drag.index + 1) % poly.length
      poly[drag.index] = add(a, scale(n, off))
      poly[j] = add(b, scale(n, off))
      preview(drag.room.t, drag.room.id, { polygon: poly })
    } else if (drag.type === 'opening') {
      const at = placeOpening(e.raw, drag.orig.width, e.ppm, !e.alt, drag.orig.id, drag.orig.host)
      if (at?.valid) preview('openings', drag.orig.id, { host: at.host, along: at.along })
    }
  },
  up(e: PlanEvent) {
    const d = drag
    drag = null
    if (!e.moved) {
      if (d && d.type !== 'box' && d.type !== 'move' && d.type !== 'opening') return // click on a handle
      const hit = downHit ?? (d ? null : e.hit) // no 'down' seen (3D orbit click): fall back to a pick now
      downHit = null
      if (!hit) {
        if (!e.shift) store.selection = []
      } else if (e.shift) {
        store.selection = store.selection.includes(hit.id) ? store.selection.filter(i => i !== hit.id) : [...store.selection, hit.id]
      } else store.selection = [hit.id]
      if (d && d.type === 'opening') preview('openings', d.orig.id, { host: d.orig.host, along: d.orig.along })
      return
    }
    if (!d) return
    if (d.type === 'box') {
      const { min, max } = bbox([d.start, d.end])
      const d2 = store.data!
      const ids = [...d2.rooms, ...d2.walls, ...d2.openings, ...d2.stairs, ...d2.zones, ...d2.items].filter(x => x.floorId === store.activeFloorId && inBox(x.id, min, max)).map(x => x.id)
      store.selection = e.shift ? [...new Set([...store.selection, ...ids])] : ids
    } else if (d.type === 'move') {
      if (!d.delta[0] && !d.delta[1]) return
      const cmds = [
        ...d.rooms.map(r => updateEntity('rooms', r.id, { polygon: r.polygon.map(p => add(p, d.delta)) }, { polygon: r.polygon })),
        ...d.walls.map(w => updateEntity('walls', w.id, { a: add(w.a, d.delta), b: add(w.b, d.delta) }, { a: w.a, b: w.b })),
        ...d.stairs.map(s => updateEntity('stairs', s.id, { x: s.x + d.delta[0], y: s.y + d.delta[1] }, { x: s.x, y: s.y })),
        ...d.zones.map(z => updateEntity('zones', z.id, { polygon: z.polygon.map(p => add(p, d.delta)) }, { polygon: z.polygon }))
      ]
      cmds.push(...d.items.map(it => updateEntity('items', it.id, { x: it.x + d.delta[0], y: it.y + d.delta[1] }, { x: it.x, y: it.y })))
      if (cmds.length) execute(batch('Move', cmds))
    } else if (d.type === 'vertex' || d.type === 'edge') {
      const now = find(d.room.t, d.room.id)!.polygon
      if (JSON.stringify(now) === JSON.stringify(d.room.polygon)) return
      const cmd = polygonCommand(d.room, clone(now), d.room.polygon, d.type === 'vertex' ? 'Move corner' : 'Move edge')
      if (cmd) execute(cmd)
      else preview(d.room.t, d.room.id, { polygon: d.room.polygon })
    } else if (d.type === 'opening') {
      const now = find('openings', d.orig.id)!
      if (now.along !== d.orig.along || JSON.stringify(now.host) !== JSON.stringify(d.orig.host))
        execute(updateEntity('openings', d.orig.id, { host: clone(now.host), along: now.along }, { host: d.orig.host, along: d.orig.along }, `Move ${d.orig.kind}`))
    }
  },
  dblclick(e) {
    const h = handleAt(e.raw, e.ppm)
    if (!h) return
    const poly = clone(h.room.polygon)
    if ('vertex' in h) {
      if (poly.length <= 3) return notify('An outline needs at least 3 corners')
      poly.splice(h.vertex!, 1)
      const cmd = polygonCommand(h.room, poly, h.room.polygon, 'Delete corner')
      if (cmd) execute(cmd)
    } else {
      const [a, b] = edges(poly)[h.edge!]
      const t = projectOnSegment(e.raw, a, b).t
      poly.splice(h.edge! + 1, 0, lerp(a, b, t))
      const cmd = polygonCommand(h.room, poly, h.room.polygon, 'Add corner')
      if (cmd) execute(cmd)
    }
  },
  key(e) {
    if (e.key === 'Escape' && drag) return cancelDrag(), true
    if (drag || e.ctrlKey || e.metaKey || e.altKey) return false
    const items = store.data!.items.filter(i => store.selection.includes(i.id))
    if (e.key.toLowerCase() === 'r' && items.length) {
      const step = e.shiftKey ? -15 : 15
      execute(batch('Rotate', items.map(it => updateEntity('items', it.id, { rotation: (((it.rotation + step) % 360) + 360) % 360 }))))
      return true
    }
    const arrows: Record<string, Vec2> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
    if (arrows[e.key] && store.selection.length) {
      const cmd = translateSelection(scale(arrows[e.key], e.shiftKey ? 0.1 : 0.01), 'Nudge')
      if (cmd) execute(cmd)
      return !!cmd
    }
    return false
  },
  cancel: cancelDrag,
  preview() {
    const shapes: Shape[] = []
    const room = selectedRoom()
    if (room) shapes.push({ kind: 'dots', points: room.polygon, color: COLORS.primary, size: 9 })
    if (drag?.type === 'box') {
      const [a, b] = [drag.start, drag.end]
      const poly: Vec2[] = [a, [b[0], a[1]], b, [a[0], b[1]]]
      shapes.push({ kind: 'fill', points: poly, color: COLORS.primary, opacity: 0.08 }, { kind: 'line', points: poly, closed: true, color: COLORS.primary, width: 1, dashed: true })
    }
    if ((drag?.type === 'vertex' || drag?.type === 'edge') && room) {
      // live lengths of the edges touching the dragged corner/edge
      const n = room.polygon.length
      const idx = drag.type === 'vertex' ? [(drag.index - 1 + n) % n, drag.index] : [(drag.index - 1 + n) % n, drag.index, (drag.index + 1) % n]
      for (const i of idx) {
        const [a, b] = edges(room.polygon)[i]
        shapes.push({ kind: 'label', at: lerp(a, b, 0.5), text: format(dist(a, b), store.settings.units) })
      }
    }
    if (drag?.type === 'move' && (drag.delta[0] || drag.delta[1]))
      shapes.push({ kind: 'label', at: add(drag.start, drag.delta), text: `Δ ${format(drag.delta[0], store.settings.units)}, ${format(drag.delta[1], store.settings.units)}` })
    return shapes
  },
  hint: () =>
    selectedRoom()
      ? 'Drag corners or walls to reshape · double-click a wall to add a corner, a corner to remove it · Alt = no snapping'
      : 'Click to select · Shift adds · drag empty space to box-select · drag to move'
})
