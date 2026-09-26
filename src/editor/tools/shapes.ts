// Plan shapes shared by the tool manager (selection outline) and the stair tool — kept apart from
// tools/stair.ts so tools/index can import it without a circular registration.
import type { Stair } from '@/types'
import type { Shape } from '@/scene/overlay'
import { store } from '../store'
import { solve, toPlan, type Warning } from '../stairs'
import { stairRise } from '../model'
import { format } from '../units'

export function warningText(w: Warning) {
  const u = store.settings.units
  if (w.code === 'rise') return `Rise ${format(w.value, u)} per step (comfortable 15–19 cm)`
  if (w.code === 'going') return `Going ${format(w.value, u)} (at least 25 cm is comfortable)`
  return `2 × rise + going = ${format(w.value, u)} (comfortable 60–65 cm)`
}

/** Plan-space shapes for a stair: footprint, treads, walk-line arrow. */
export function stairShapes(s: Stair, color: string, width = 2): Shape[] {
  const sol = solve(s.kind, s.params, stairRise(store.data!, s.floorId, store.settings.slab))
  const fp = toPlan(s, sol.footprint)
  return [
    { kind: 'line', points: fp, closed: true, color, width },
    ...sol.treads.map(t => ({ kind: 'line' as const, points: toPlan(s, t.poly), closed: true, color, width: 1 })),
    { kind: 'line', points: toPlan(s, sol.walk), color, width: 1, dashed: true }
  ]
}
