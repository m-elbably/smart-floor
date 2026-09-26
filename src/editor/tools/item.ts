// Furniture placement: a ghost footprint follows the cursor (grid snap); wall items glue their back to
// the nearest wall and face into the room. R / Shift+R rotate ±15°. Click places; the tool stays armed.
import type { Item, Vec2 } from '@/types'
import { COLORS, type Shape } from '@/scene/overlay'
import { catalogItem, itemFootprint } from '@/catalog'
import { store, activeFloor, saveSettings } from '../store'
import { execute, addEntity } from '../commands'
import { add, dot, norm, projectOnSegment, scale, segDistance, sub, lerp } from '../geometry'
import { floorWalls } from '../model'
import { format } from '../units'
import { registerTool, type PlanEvent } from './index'

let at: { x: number; y: number; rotation: number; wall: boolean } | null = null
let turn = 0 // manual rotation (degrees) for free-standing items

export function remember(catalogId: string) {
  saveSettings({ recent: [catalogId, ...store.settings.recent.filter(id => id !== catalogId)].slice(0, 8) })
}

/** Where an item goes for a cursor position. */
export function placeItem(catalogId: string, raw: Vec2, ppm: number, free: boolean, rotation: number) {
  const def = catalogItem(catalogId)
  if (!def) return null
  if (def.placement === 'wall') {
    const walls = floorWalls(store.data!, activeFloor.value!.id, store.settings)
    let best: { p: Vec2; n: Vec2; t: number } | null = null
    let bd = Math.max(0.8, 20 / ppm)
    for (const w of walls) {
      const d = segDistance(raw, w.a, w.b)
      if (d >= bd) continue
      bd = d
      const p = projectOnSegment(raw, w.a, w.b).point
      const dir = norm(sub(w.b, w.a))
      let n: Vec2 = [-dir[1], dir[0]]
      if (dot(n, sub(raw, p)) < 0) n = scale(n, -1) // face the side the cursor is on
      best = { p, n, t: w.thickness }
    }
    if (best) {
      const c = add(best.p, scale(best.n, best.t / 2 + def.size[1] / 2 + 0.005))
      // front (local −y) must point along n: rotate [0, −1] onto n
      const rot = (Math.atan2(best.n[0], -best.n[1]) * 180) / Math.PI
      return { x: c[0], y: c[1], rotation: ((rot % 360) + 360) % 360, wall: true }
    }
  }
  const g = free ? 0 : store.settings.grid
  const snap = (v: number) => (g ? Math.round(v / g) * g : v)
  return { x: snap(raw[0]), y: snap(raw[1]), rotation, wall: false }
}

registerTool({
  id: 'item',
  snaps: () => false,
  move(e: PlanEvent) {
    at = placeItem(store.toolOptions.item, e.raw, e.ppm, e.alt, turn)
  },
  up(e) {
    if (e.moved) return
    at = placeItem(store.toolOptions.item, e.raw, e.ppm, e.alt, turn)
    if (!at) return
    const def = catalogItem(store.toolOptions.item)!
    const it: Item = {
      id: crypto.randomUUID(),
      floorId: activeFloor.value!.id,
      catalogId: def.id,
      x: at.x,
      y: at.y,
      z: 0,
      rotation: at.rotation,
      scale: [1, 1, 1],
      variant: null,
      name: null
    }
    execute(addEntity('items', it, `Add ${def.name}`))
    remember(def.id)
  },
  key(e) {
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) return (turn = (turn + (e.shiftKey ? -15 : 15) + 360) % 360), true
    return false
  },
  cancel() {
    at = null
    turn = 0 // each newly picked item starts unrotated
  },
  preview() {
    const def = catalogItem(store.toolOptions.item)
    if (!at || !def) return []
    const fp = itemFootprint({ catalogId: def.id, x: at.x, y: at.y, rotation: at.rotation, scale: [1, 1, 1] })
    const front = lerp(fp[0], fp[1], 0.5) // local −y edge
    const shapes: Shape[] = [
      { kind: 'fill', points: fp, color: COLORS.draw, opacity: 0.25 },
      { kind: 'line', points: fp, closed: true, color: COLORS.draw },
      { kind: 'line', points: [[at.x, at.y], front], color: COLORS.draw, width: 1, dashed: true },
      { kind: 'label', at: fp[2], text: `${def.name} · ${format(def.size[0], store.settings.units)} × ${format(def.size[1], store.settings.units)}` }
    ]
    return shapes
  },
  hint: () => {
    const def = catalogItem(store.toolOptions.item)
    if (!def) return 'Pick an item in the catalog'
    return def.placement === 'wall' ? `Move near a wall and click to place ${def.name} · Alt = free` : `Click to place ${def.name} · R / Shift+R rotate 15° · Esc stops`
  }
})
