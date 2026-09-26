// Measure tape: click, click → distance (+ angle). The result stays until the next click or Esc.
// Shift locks the direction to 15° steps.
import type { Vec2 } from '@/types'
import { COLORS, type Shape } from '@/scene/overlay'
import { store } from '../store'
import { add, dist, lerp, norm, scale, sub } from '../geometry'
import { format } from '../units'
import { registerTool, type PlanEvent } from './index'

let a: Vec2 | null = null
let b: Vec2 | null = null
let cur: Vec2 | null = null

function lock(from: Vec2, p: Vec2): Vec2 {
  const ang = Math.round(Math.atan2(p[1] - from[1], p[0] - from[0]) / (Math.PI / 12)) * (Math.PI / 12)
  const L = dist(from, p)
  return [from[0] + Math.cos(ang) * L, from[1] + Math.sin(ang) * L]
}
const at = (e: PlanEvent) => (a && !b && e.shift ? lock(a, e.p) : e.p)

registerTool({
  id: 'measure',
  snapFrom: () => (b ? null : a),
  move(e) {
    cur = at(e)
  },
  up(e) {
    if (e.moved) return
    if (!a || b) (a = e.p), (b = null)
    else b = at(e)
  },
  key(e) {
    if (e.key === 'Escape' && a) return (a = b = null), true
    return false
  },
  cancel() {
    a = b = cur = null
  },
  preview() {
    const end = b ?? cur
    if (!a || !end) return []
    const d = sub(end, a)
    const n = scale(norm([-d[1], d[0]]), 0.12)
    const deg = ((Math.atan2(d[1], d[0]) * 180) / Math.PI + 360) % 360
    const shapes: Shape[] = [
      { kind: 'line', points: [a, end], color: COLORS.guide, width: 2 },
      { kind: 'line', points: [add(a, n), sub(a, n)], color: COLORS.guide, width: 2 },
      { kind: 'line', points: [add(end, n), sub(end, n)], color: COLORS.guide, width: 2 },
      { kind: 'label', at: lerp(a, end, 0.5), text: `${format(dist(a, end), store.settings.units)} · ${deg.toFixed(1)}°` }
    ]
    return shapes
  },
  hint: () => (a && !b ? 'Click the end point · Shift locks 15° · Esc clears' : 'Click two points to measure')
})
