import type { Vec2, Room, Wall, Item, Stair, Zone, Opening } from '@/types'
import { store } from './store'
import { execute, updateEntity, batch, preview, type Command } from './commands'
import { bbox, lerp } from './geometry'
import { itemFootprint } from '@/catalog'

export function rotatePoint(p: Vec2, origin: Vec2, deg: number): Vec2 {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p[0] - origin[0]
  const dy = p[1] - origin[1]
  return [
    Math.round((origin[0] + dx * cos - dy * sin) * 1000) / 1000,
    Math.round((origin[1] + dx * sin + dy * cos) * 1000) / 1000
  ]
}

export function getSelectedEntities(): {
  rooms: Room[]
  walls: Wall[]
  items: Item[]
  stairs: Stair[]
  zones: Zone[]
  openings: Opening[]
} {
  const data = store.data
  if (!data) return { rooms: [], walls: [], items: [], stairs: [], zones: [], openings: [] }
  const sel = (id: string) => store.selection.includes(id)
  return {
    rooms: data.rooms.filter(r => sel(r.id)),
    walls: data.walls.filter(w => sel(w.id)),
    items: data.items.filter(i => sel(i.id)),
    stairs: data.stairs.filter(s => sel(s.id)),
    zones: data.zones.filter(z => sel(z.id)),
    openings: data.openings.filter(o => sel(o.id))
  }
}

export function getSelectionBbox(): { min: Vec2; max: Vec2 } | null {
  const { rooms, walls, items, stairs, zones } = getSelectedEntities()
  const pts: Vec2[] = []
  for (const r of rooms) pts.push(...r.polygon)
  for (const z of zones) pts.push(...z.polygon)
  for (const w of walls) pts.push(w.a, w.b)
  for (const s of stairs) {
    pts.push([s.x - 0.5, s.y - 0.5], [s.x + 0.5, s.y + 0.5])
  }
  for (const i of items) {
    pts.push(...itemFootprint(i))
  }
  if (!pts.length) return null
  return bbox(pts)
}

export function getSelectionOrigin(): Vec2 | null {
  const { rooms, walls, items, stairs, zones } = getSelectedEntities()
  const total = rooms.length + walls.length + items.length + stairs.length + zones.length
  if (total === 0) return null

  // If a single element is selected, rotate around its natural center
  if (total === 1) {
    if (items.length === 1) return [items[0].x, items[0].y]
    if (stairs.length === 1) return [stairs[0].x, stairs[0].y]
    if (walls.length === 1) return lerp(walls[0].a, walls[0].b, 0.5)
    if (rooms.length === 1) {
      const b = bbox(rooms[0].polygon)
      return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]
    }
    if (zones.length === 1) {
      const b = bbox(zones[0].polygon)
      return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]
    }
  }

  // Otherwise, rotate around the collective bounding box center
  const box = getSelectionBbox()
  if (!box) return null
  return [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2]
}

export function previewRotate(
  deg: number,
  origin?: Vec2,
  snapshot?: Map<string, Record<string, unknown>>
) {
  const o = origin ?? getSelectionOrigin()
  if (!o) return
  const { rooms, walls, items, stairs, zones } = getSelectedEntities()
  for (const r of rooms) {
    const basePoly = (snapshot?.get(r.id)?.polygon as Vec2[]) ?? r.polygon
    preview('rooms', r.id, { polygon: basePoly.map(p => rotatePoint(p, o, deg)) })
  }
  for (const z of zones) {
    const basePoly = (snapshot?.get(z.id)?.polygon as Vec2[]) ?? z.polygon
    preview('zones', z.id, { polygon: basePoly.map(p => rotatePoint(p, o, deg)) })
  }
  for (const w of walls) {
    const baseA = (snapshot?.get(w.id)?.a as Vec2) ?? w.a
    const baseB = (snapshot?.get(w.id)?.b as Vec2) ?? w.b
    preview('walls', w.id, { a: rotatePoint(baseA, o, deg), b: rotatePoint(baseB, o, deg) })
  }
  for (const it of items) {
    const basePos: Vec2 = snapshot?.has(it.id)
      ? [(snapshot.get(it.id)!.x as number), (snapshot.get(it.id)!.y as number)]
      : [it.x, it.y]
    const baseRot = snapshot?.has(it.id)
      ? (snapshot.get(it.id)!.rotation as number)
      : it.rotation
    const pos = rotatePoint(basePos, o, deg)
    preview('items', it.id, { x: pos[0], y: pos[1], rotation: (((baseRot + deg) % 360) + 360) % 360 })
  }
  for (const s of stairs) {
    const basePos: Vec2 = snapshot?.has(s.id)
      ? [(snapshot.get(s.id)!.x as number), (snapshot.get(s.id)!.y as number)]
      : [s.x, s.y]
    const baseRot = snapshot?.has(s.id)
      ? (snapshot.get(s.id)!.rotation as number)
      : s.rotation
    const pos = rotatePoint(basePos, o, deg)
    preview('stairs', s.id, { x: pos[0], y: pos[1], rotation: (((baseRot + deg) % 360) + 360) % 360 })
  }
}

export function rotateSelectionCmd(
  deg: number,
  origin?: Vec2,
  prevSnapshot?: Map<string, Record<string, unknown>>
): Command | null {
  const o = origin ?? getSelectionOrigin()
  const { rooms, walls, items, stairs, zones, openings } = getSelectedEntities()
  const cmds: Command[] = []

  // If only openings are selected: flip door hinge/swing
  if (
    openings.length > 0 &&
    rooms.length === 0 &&
    walls.length === 0 &&
    items.length === 0 &&
    stairs.length === 0 &&
    zones.length === 0
  ) {
    const FLIPS = [
      { hinge: 'left', swing: 'in' },
      { hinge: 'right', swing: 'in' },
      { hinge: 'right', swing: 'out' },
      { hinge: 'left', swing: 'out' }
    ]
    for (const op of openings) {
      if (op.kind === 'door') {
        const curHinge = (op.props as Record<string, string>)?.hinge ?? 'left'
        const curSwing = (op.props as Record<string, string>)?.swing ?? 'in'
        const idx = FLIPS.findIndex(f => f.hinge === curHinge && f.swing === curSwing)
        const next = FLIPS[(((idx + (deg > 0 ? 1 : -1)) % FLIPS.length) + FLIPS.length) % FLIPS.length]
        cmds.push(
          updateEntity(
            'openings',
            op.id,
            { props: { ...op.props, ...next } },
            { props: op.props },
            'Flip door'
          )
        )
      }
    }
    return cmds.length ? (cmds.length === 1 ? cmds[0] : batch('Flip doors', cmds)) : null
  }

  if (!o) return null

  for (const r of rooms) {
    const basePoly = (prevSnapshot?.get(r.id)?.polygon as Vec2[]) ?? r.polygon
    const next = basePoly.map(p => rotatePoint(p, o, deg))
    cmds.push(updateEntity('rooms', r.id, { polygon: next }, { polygon: basePoly }))
  }
  for (const z of zones) {
    const basePoly = (prevSnapshot?.get(z.id)?.polygon as Vec2[]) ?? z.polygon
    const next = basePoly.map(p => rotatePoint(p, o, deg))
    cmds.push(updateEntity('zones', z.id, { polygon: next }, { polygon: basePoly }))
  }
  for (const w of walls) {
    const baseA = (prevSnapshot?.get(w.id)?.a as Vec2) ?? w.a
    const baseB = (prevSnapshot?.get(w.id)?.b as Vec2) ?? w.b
    const nextA = rotatePoint(baseA, o, deg)
    const nextB = rotatePoint(baseB, o, deg)
    cmds.push(updateEntity('walls', w.id, { a: nextA, b: nextB }, { a: baseA, b: baseB }))
  }
  for (const it of items) {
    const basePos: Vec2 = prevSnapshot?.has(it.id)
      ? [(prevSnapshot.get(it.id)!.x as number), (prevSnapshot.get(it.id)!.y as number)]
      : [it.x, it.y]
    const baseRot = prevSnapshot?.has(it.id)
      ? (prevSnapshot.get(it.id)!.rotation as number)
      : it.rotation
    const pos = rotatePoint(basePos, o, deg)
    const rot = (((baseRot + deg) % 360) + 360) % 360
    cmds.push(
      updateEntity(
        'items',
        it.id,
        { x: pos[0], y: pos[1], rotation: rot },
        { x: basePos[0], y: basePos[1], rotation: baseRot }
      )
    )
  }
  for (const s of stairs) {
    const basePos: Vec2 = prevSnapshot?.has(s.id)
      ? [(prevSnapshot.get(s.id)!.x as number), (prevSnapshot.get(s.id)!.y as number)]
      : [s.x, s.y]
    const baseRot = prevSnapshot?.has(s.id)
      ? (prevSnapshot.get(s.id)!.rotation as number)
      : s.rotation
    const pos = rotatePoint(basePos, o, deg)
    const rot = (((baseRot + deg) % 360) + 360) % 360
    cmds.push(
      updateEntity(
        'stairs',
        s.id,
        { x: pos[0], y: pos[1], rotation: rot },
        { x: basePos[0], y: basePos[1], rotation: baseRot }
      )
    )
  }

  if (!cmds.length) return null
  return cmds.length === 1 ? cmds[0] : batch('Rotate', cmds)
}

export function rotateSelection(deg: number, origin?: Vec2) {
  const cmd = rotateSelectionCmd(deg, origin)
  if (cmd) execute(cmd)
}
