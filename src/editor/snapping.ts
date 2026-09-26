// Point snapping, first candidate wins: vertex → midpoint → edge → x/y alignment → 15° angle → grid.
// Radii are screen pixels converted with the current zoom (ppm = pixels per metre).
import type { Vec2 } from '../types'
import { dist, projectOnSegment, lerp } from './geometry'

export type SnapKind = 'vertex' | 'midpoint' | 'edge' | 'align' | 'angle' | 'grid'

export interface SnapHit {
  kind: SnapKind | null
  point: Vec2
  guides: [Vec2, Vec2][]
  /** Segment index for 'edge' / 'midpoint' hits. */
  segment?: number
}

export interface SnapCtx {
  vertices: Vec2[]
  segments: [Vec2, Vec2][]
  ppm: number
  grid: number
  prev?: Vec2 | null
}

const PX = { vertex: 12, midpoint: 10, edge: 8, align: 6 }
const ANGLE_STEP = 15
const ANGLE_TOL = 4

const round = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

export function snap(raw: Vec2, c: SnapCtx): SnapHit {
  const r = (px: number) => px / c.ppm
  const nearest = <T>(items: T[], d: (x: T) => number, max: number) => {
    let best: T | null = null
    let bd = max
    for (const it of items) {
      const v = d(it)
      if (v < bd) (best = it), (bd = v)
    }
    return best
  }

  const v = nearest(c.vertices, p => dist(p, raw), r(PX.vertex))
  if (v) return { kind: 'vertex', point: v, guides: [] }

  const mids = c.segments.map(([a, b], i) => ({ p: lerp(a, b, 0.5), i }))
  const m = nearest(mids, x => dist(x.p, raw), r(PX.midpoint))
  if (m) return { kind: 'midpoint', point: m.p, guides: [], segment: m.i }

  const projs = c.segments.map(([a, b], i) => ({ p: projectOnSegment(raw, a, b).point, i }))
  const e = nearest(projs, x => dist(x.p, raw), r(PX.edge))
  if (e) return { kind: 'edge', point: e.p, guides: [], segment: e.i }

  const ax = nearest(c.vertices, p => Math.abs(p[0] - raw[0]), r(PX.align))
  const ay = nearest(c.vertices, p => Math.abs(p[1] - raw[1]), r(PX.align))
  if (ax || ay) {
    const point: Vec2 = [ax ? ax[0] : round(raw[0], c.grid), ay ? ay[1] : round(raw[1], c.grid)]
    const guides: [Vec2, Vec2][] = []
    if (ax) guides.push([ax, point])
    if (ay) guides.push([ay, point])
    return { kind: 'align', point, guides }
  }

  if (c.prev && dist(c.prev, raw) > r(20)) {
    const ang = (Math.atan2(raw[1] - c.prev[1], raw[0] - c.prev[0]) * 180) / Math.PI
    const lock = Math.round(ang / ANGLE_STEP) * ANGLE_STEP
    if (Math.abs(ang - lock) < ANGLE_TOL) {
      const rad = (lock * Math.PI) / 180
      const L = round(dist(c.prev, raw), c.grid)
      const point: Vec2 = [c.prev[0] + Math.cos(rad) * L, c.prev[1] + Math.sin(rad) * L]
      return { kind: 'angle', point, guides: [[c.prev, point]] }
    }
  }

  return { kind: c.grid > 0 ? 'grid' : null, point: [round(raw[0], c.grid), round(raw[1], c.grid)], guides: [] }
}
