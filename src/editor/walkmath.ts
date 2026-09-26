// Pure helpers for walk mode: circle-vs-wall collision with sliding, and standing height on stairs.
import type { Vec2 } from '@/types'
import { add, dist, projectOnSegment, scale, sub, pointInPolygon } from './geometry'

/** A wall as a thick segment (centreline a→b, half its thickness). */
export interface Blocker {
  a: Vec2
  b: Vec2
  half: number
}

/**
 * Push a circle of radius r at p out of every blocker it overlaps. A few passes settle corners;
 * because only the overlapping component is removed, movement along a wall is kept (sliding).
 */
export function collide(p: Vec2, blockers: Blocker[], r: number): Vec2 {
  let q = p
  for (let pass = 0; pass < 4; pass++) {
    let moved = false
    for (const w of blockers) {
      const c = projectOnSegment(q, w.a, w.b).point
      const d = dist(q, c)
      const min = r + w.half
      if (d >= min) continue
      const dir: Vec2 = d > 1e-9 ? scale(sub(q, c), 1 / d) : [0, 1]
      q = add(c, scale(dir, min))
      moved = true
    }
    if (!moved) break
  }
  return q
}

export interface StairRun {
  footprint: Vec2[] // plan
  walk: Vec2[] // plan walk line, bottom → top
  base: number // elevation of the stair's floor
  rise: number
  lowerFloorId: string
  upperFloorId: string | null
}

/** Height of the walking surface at p if it is on a stair, with the floor you're "on" (upper past halfway). */
export function onStair(p: Vec2, runs: StairRun[]): { z: number; floorId: string } | null {
  for (const s of runs) {
    if (!pointInPolygon(p, s.footprint)) continue
    // distance along the walk line of the closest point, as a fraction of its length
    let best = Infinity
    let at = 0
    let acc = 0
    const lens = s.walk.slice(1).map((q, i) => dist(q, s.walk[i]))
    const total = lens.reduce((a, b) => a + b, 0) || 1
    s.walk.slice(1).forEach((q, i) => {
      const pr = projectOnSegment(p, s.walk[i], q)
      const d = dist(p, pr.point)
      if (d < best) (best = d), (at = acc + pr.t * lens[i])
      acc += lens[i]
    })
    const t = Math.min(1, Math.max(0, at / total))
    return { z: s.base + t * s.rise, floorId: t > 0.5 && s.upperFloorId ? s.upperFloorId : s.lowerFloorId }
  }
  return null
}
