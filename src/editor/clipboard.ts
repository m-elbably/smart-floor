// Copy / cut / paste / duplicate of the selection. Pasted rooms keep their openings; everything gets new ids.
import type { Opening, Room, Stair, Vec2, Wall } from '@/types'
import { store, activeFloor, notify } from './store'
import { execute, batch, addEntity, removeEntity, locate, type Command } from './commands'
import { add, bbox, lerp, sub } from './geometry'

interface Clip {
  rooms: Room[]
  walls: Wall[]
  stairs: Stair[]
  openings: Opening[]
  center: Vec2
}
let clip: Clip | null = null
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export function copy(): boolean {
  const d = store.data
  if (!d || !store.selection.length) return false
  const rooms = d.rooms.filter(r => store.selection.includes(r.id))
  const walls = d.walls.filter(w => store.selection.includes(w.id))
  const stairs = d.stairs.filter(s => store.selection.includes(s.id))
  const ids = new Set([...rooms, ...walls].map(e => e.id))
  const openings = d.openings.filter(o => ids.has('roomId' in o.host ? o.host.roomId : o.host.wallId))
  const pts = [...rooms.flatMap(r => r.polygon), ...walls.flatMap(w => [w.a, w.b]), ...stairs.map(s => [s.x, s.y] as Vec2)]
  if (!pts.length) return false
  const { min, max } = bbox(pts)
  clip = clone({ rooms, walls, stairs, openings, center: lerp(min, max, 0.5) })
  return true
}

/** Paste centred on `at` (defaults to 0.5 m right/down of the original). */
export function paste(at?: Vec2) {
  if (!clip || !store.data || !activeFloor.value) return
  const offset = at ? sub(at, clip.center) : ([0.5, -0.5] as Vec2)
  const ids = new Map<string, string>()
  const nid = (old: string) => ids.get(old) ?? (ids.set(old, crypto.randomUUID()), ids.get(old)!)
  const floorId = activeFloor.value.id
  const cmds: Command[] = []
  for (const r of clip.rooms) cmds.push(addEntity('rooms', { ...clone(r), id: nid(r.id), floorId, polygon: r.polygon.map(p => add(p, offset)) }))
  for (const w of clip.walls) cmds.push(addEntity('walls', { ...clone(w), id: nid(w.id), floorId, a: add(w.a, offset), b: add(w.b, offset) }))
  for (const s of clip.stairs) cmds.push(addEntity('stairs', { ...clone(s), id: nid(s.id), floorId, x: s.x + offset[0], y: s.y + offset[1] }))
  for (const o of clip.openings) {
    const host = 'roomId' in o.host ? { roomId: nid(o.host.roomId), edge: o.host.edge } : { wallId: nid(o.host.wallId) }
    cmds.push(addEntity('openings', { ...clone(o), id: nid(o.id), floorId, host }))
  }
  execute(batch('Paste', cmds))
  store.selection = [...clip.rooms, ...clip.walls, ...clip.stairs].map(e => ids.get(e.id)!)
}

export function deleteSelection(label = 'Delete') {
  const found = store.selection.map(id => locate(id)).filter(x => x !== null)
  if (!found.length) return
  // Openings first so a room's removal doesn't try to remove them again.
  found.sort((a, b) => Number(b.t === 'openings') - Number(a.t === 'openings'))
  execute(batch(label, found.map(f => removeEntity(f.t, f.e.id))))
  store.selection = []
}

export function cut() {
  if (copy()) deleteSelection('Cut')
}

export function duplicate() {
  if (copy()) paste()
  else notify('Select rooms, walls or stairs to duplicate')
}
