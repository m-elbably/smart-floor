// Free-standing wall tool: click a chain of segments; double-click, Enter or Esc ends the chain.
import type { Vec2, Wall } from '@/types'
import { COLORS } from '@/scene/overlay'
import { store, activeFloor } from '../store'
import { execute, addEntity } from '../commands'
import { add, dist, lerp, norm, scale, sub } from '../geometry'
import { format } from '../units'
import { registerTool } from './index'
import { createEntry } from './entry'

const fence = () => store.toolOptions.wall === 'fence'
let start: Vec2 | null = null
let cur: Vec2 | null = null
const entry = createEntry()

function place(end: Vec2) {
  if (!start || dist(start, end) < 0.05) return
  const wall: Wall = {
    id: crypto.randomUUID(),
    floorId: activeFloor.value!.id,
    a: start,
    b: end,
    // Fences: thin, waist-high posts and rails.
    thickness: fence() ? 0.05 : store.settings.wallInterior,
    height: fence() ? 1.2 : activeFloor.value!.height,
    kind: fence() ? 'fence' : 'wall'
  }
  execute(addEntity('walls', wall, fence() ? 'Add fence' : 'Add wall'))
  start = end
}

function cancel() {
  start = cur = null
  entry.clear()
}

registerTool({
  id: 'wall',
  snapFrom: () => start,
  move(e) {
    cur = e.p
  },
  up(e) {
    if (e.moved) return
    if (!start) start = e.p
    else place(e.p)
  },
  dblclick: cancel,
  key(e) {
    if (start && entry.key(e)) return true
    if ((e.key === 'Escape' || e.key === 'Enter') && start) {
      const v = e.key === 'Enter' && entry.text ? entry.values(store.settings.units) : null
      if (v && cur) {
        place(add(start, scale(norm(sub(cur, start)), v[0])))
        entry.clear()
      } else cancel()
      return true
    }
    return false
  },
  cancel,
  preview() {
    if (!start || !cur) return []
    return [
      { kind: 'line', points: [start, cur], color: COLORS.draw, width: 4 },
      { kind: 'label', at: lerp(start, cur, 0.5), text: entry.text ? `${entry.text} ↵` : format(dist(start, cur), store.settings.units) }
    ]
  },
  hint: () => (start ? 'Click the next point · type a length + Enter · double-click or Esc ends' : `Click to start a ${fence() ? 'fence' : 'free-standing wall'}`)
})
