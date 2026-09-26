// Stair solver. Local frame: the stair climbs from local y = 0 toward +y (spiral: origin is the column
// centre, climbing counter-clockwise from +x). A stair with n risers has n − 1 treads; the last riser
// lands on the floor above. Plan position = rotate(local, rotation°) + (x, y).
import type { Stair, Vec2 } from '@/types'
import { add, area, centroid, cross, lerp, scale, sub, ensureCCW } from './geometry'

export type StairKind = Stair['kind']

import type { StairParams } from '@/types'
export type { StairParams }

export const TARGET_RISE = 0.175
export const DEFAULT_PARAMS: Omit<StairParams, 'steps'> = { width: 1, going: 0.27, railLeft: false, railRight: true }
export const COLUMN_R = 0.1
const U_GAP = 0.1

export const minSteps = (kind: StairKind) => (kind === 'L' || kind === 'U' ? 4 : 3)
export const defaultSteps = (totalRise: number, kind: StairKind = 'straight') => Math.max(minSteps(kind), Math.round(totalRise / TARGET_RISE))

export interface Tread {
  poly: Vec2[] // local, CCW
  top: number // height of the walking surface above the stair's floor
  left: Vec2 // points on the left / right edge, for railings
  right: Vec2
  landing?: boolean
}

export type Warning = { code: 'rise' | 'going' | 'stride'; value: number }

export interface StairSolution {
  steps: number
  rise: number
  going: number
  runLength: number
  treads: Tread[]
  footprint: Vec2[] // local, CCW
  pieces: Vec2[][] // convex parts of the footprint (for the stairwell void)
  walk: Vec2[] // walk line from bottom to top (plan arrow, walk mode)
  warnings: Warning[]
}

/** FR-42: comfortable rise 15–19 cm, going ≥ 25 cm, 2·rise + going within 60–65 cm. Warnings never block. */
export function comfortWarnings(rise: number, going: number): Warning[] {
  const w: Warning[] = []
  const r = (v: number) => Math.round(v * 1e4) / 1e4
  if (r(rise) < 0.15 || r(rise) > 0.19) w.push({ code: 'rise', value: rise })
  if (r(going) < 0.25) w.push({ code: 'going', value: going })
  const stride = 2 * rise + going
  if (r(stride) < 0.6 || r(stride) > 0.65) w.push({ code: 'stride', value: stride })
  return w
}

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

export function solve(kind: StairKind, p: Pick<StairParams, 'width' | 'steps' | 'going'>, totalRise: number): StairSolution {
  const n = Math.max(minSteps(kind), Math.round(p.steps))
  const t = n - 1 // treads (a landing counts as one)
  const rise = totalRise / n
  const w = p.width
  const g = p.going
  const treads: Tread[] = []
  const top = (i: number) => (i + 1) * rise
  let footprint: Vec2[]
  let pieces: Vec2[][]
  let walk: Vec2[]
  const going = g

  if (kind === 'straight') {
    for (let i = 0; i < t; i++) treads.push({ poly: rect(-w / 2, i * g, w / 2, (i + 1) * g), top: top(i), left: [-w / 2, (i + 0.5) * g], right: [w / 2, (i + 0.5) * g] })
    footprint = rect(-w / 2, 0, w / 2, t * g)
    pieces = [footprint]
    walk = [[0, 0], [0, t * g]]
  } else if (kind === 'L' || kind === 'U') {
    const a = Math.max(1, Math.floor((t - 1) / 2)) // treads before the landing
    const b = t - 1 - a // treads after it
    const ly = a * g // landing starts here
    for (let i = 0; i < a; i++) treads.push({ poly: rect(-w / 2, i * g, w / 2, (i + 1) * g), top: top(i), left: [-w / 2, (i + 0.5) * g], right: [w / 2, (i + 0.5) * g] })
    if (kind === 'L') {
      // turn right: second flight runs +x
      treads.push({ poly: rect(-w / 2, ly, w / 2, ly + w), top: top(a), left: [-w / 2, ly + w], right: [w / 2, ly], landing: true })
      for (let j = 0; j < b; j++) {
        const x = w / 2 + j * g
        treads.push({ poly: rect(x, ly, x + g, ly + w), top: top(a + 1 + j), left: [x + g / 2, ly + w], right: [x + g / 2, ly] })
      }
      footprint = [[-w / 2, 0], [w / 2, 0], [w / 2, ly], [w / 2 + b * g, ly], [w / 2 + b * g, ly + w], [-w / 2, ly + w]]
      pieces = [rect(-w / 2, 0, w / 2, ly + w), rect(w / 2, ly, w / 2 + b * g, ly + w)]
      walk = [[0, 0], [0, ly + w / 2], [w / 2 + b * g, ly + w / 2]]
    } else {
      // turn back: second flight runs −y beside the first
      const x2 = w + U_GAP // centre of the second flight
      treads.push({ poly: rect(-w / 2, ly, x2 + w / 2, ly + w), top: top(a), left: [x2 / 2, ly + w], right: [x2 / 2, ly], landing: true })
      for (let j = 0; j < b; j++) {
        const y = ly - j * g
        treads.push({ poly: rect(x2 - w / 2, y - g, x2 + w / 2, y), top: top(a + 1 + j), left: [x2 + w / 2, y - g / 2], right: [x2 - w / 2, y - g / 2] })
      }
      footprint = rect(-w / 2, Math.min(0, ly - b * g), x2 + w / 2, ly + w)
      pieces = [footprint]
      walk = [[0, 0], [0, ly + w / 2], [x2, ly + w / 2], [x2, ly - b * g]]
    }
  } else {
    // spiral: wedges around a centre column, sized so the walk line (60 % out) gets the going
    const R = COLUMN_R + w
    const rw = COLUMN_R + 0.6 * w
    const th = g / rw
    const polar = (r: number, a: number): Vec2 => [r * Math.cos(a), r * Math.sin(a)]
    for (let i = 0; i < t; i++) {
      const [a0, a1] = [i * th, (i + 1) * th]
      const arc = [0, 1, 2, 3].map(k => polar(R, a0 + ((a1 - a0) * k) / 3))
      treads.push({ poly: [polar(COLUMN_R, a0), ...arc, polar(COLUMN_R, a1)], top: top(i), left: polar(COLUMN_R, (a0 + a1) / 2), right: polar(R, (a0 + a1) / 2) })
    }
    footprint = Array.from({ length: 32 }, (_, k) => polar(R, (k / 32) * Math.PI * 2))
    pieces = [footprint]
    walk = Array.from({ length: t + 1 }, (_, i) => polar(rw, i * th))
  }

  const runLength = walk.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - walk[i][0], q[1] - walk[i][1]), 0)
  return { steps: n, rise, going, runLength, treads, footprint: ensureCCW(footprint), pieces, walk, warnings: comfortWarnings(rise, going) }
}

export function toPlan(s: { x: number; y: number; rotation: number }, pts: Vec2[]): Vec2[] {
  const r = (s.rotation * Math.PI) / 180
  const [c, sn] = [Math.cos(r), Math.sin(r)]
  return pts.map(([x, y]) => [x * c - y * sn + s.x, x * sn + y * c + s.y])
}

// ---------- stairwell void ----------

/** Sutherland–Hodgman: `subject` (any simple polygon) clipped by a convex CCW `clip`. */
export function clipConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
  let out = subject
  for (let i = 0; i < clip.length && out.length; i++) {
    const [a, b] = [clip[i], clip[(i + 1) % clip.length]]
    const inside = (p: Vec2) => cross(sub(b, a), sub(p, a)) >= 0
    const hit = (p: Vec2, q: Vec2): Vec2 => {
      const d1 = cross(sub(b, a), sub(p, a))
      const d2 = cross(sub(b, a), sub(q, a))
      return lerp(p, q, d1 / (d1 - d2))
    }
    const src = out
    out = []
    for (let j = 0; j < src.length; j++) {
      const [p, q] = [src[j], src[(j + 1) % src.length]]
      if (inside(q)) {
        if (!inside(p)) out.push(hit(p, q))
        out.push(q)
      } else if (inside(p)) out.push(hit(p, q))
    }
  }
  return out
}

/**
 * Holes to cut in a room slab for stair footprints below it (plan coords, convex pieces).
 * Each hole is pulled 2 mm toward its centre so it never touches the slab outline (earcut needs that).
 * ponytail: a room that is concave right where it meets the stairwell may get a slightly off hole;
 * swap in a real polygon boolean if that ever shows.
 */
export function stairwellHoles(roomPoly: Vec2[], pieces: Vec2[][]): Vec2[][] {
  const holes: Vec2[][] = []
  for (const piece of pieces) {
    const inter = clipConvex(ensureCCW(roomPoly), ensureCCW(piece))
    if (inter.length < 3 || area(inter) < 0.01) continue
    const c = centroid(inter)
    holes.push(inter.map(p => add(c, scale(sub(p, c), 1 - 0.002 / Math.max(1e-6, Math.hypot(p[0] - c[0], p[1] - c[1]))))))
  }
  return holes
}
