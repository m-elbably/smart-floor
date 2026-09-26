// Pure plan geometry. Points are [x, y] metres; polygons are closed implicitly (last → first).
import type { Vec2 } from '@/types'

export const EPS = 1e-3 // 1 mm

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]]
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k]
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1]
export const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0]
export const len = (a: Vec2) => Math.hypot(a[0], a[1])
export const dist = (a: Vec2, b: Vec2) => len(sub(a, b))
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
export const norm = (a: Vec2): Vec2 => scale(a, 1 / (len(a) || 1))
/** Right-hand normal; for a CCW polygon it points outward. */
export const rightNormal = (d: Vec2): Vec2 => norm([d[1], -d[0]])

export const edges = (poly: Vec2[]): [Vec2, Vec2][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]])

export function signedArea(poly: Vec2[]) {
  let s = 0
  for (const [a, b] of edges(poly)) s += cross(a, b)
  return s / 2
}

export const area = (poly: Vec2[]) => Math.abs(signedArea(poly))

export function centroid(poly: Vec2[]): Vec2 {
  const A = signedArea(poly)
  if (Math.abs(A) < 1e-9) return scale(poly.reduce(add, [0, 0]), 1 / poly.length)
  let cx = 0
  let cy = 0
  for (const [a, b] of edges(poly)) {
    const k = cross(a, b)
    cx += (a[0] + b[0]) * k
    cy += (a[1] + b[1]) * k
  }
  return [cx / (6 * A), cy / (6 * A)]
}

export const ensureCCW = (poly: Vec2[]): Vec2[] => (signedArea(poly) < 0 ? [...poly].reverse() : poly)

function segsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2) {
  const d1 = cross(sub(p4, p3), sub(p1, p3))
  const d2 = cross(sub(p4, p3), sub(p2, p3))
  const d3 = cross(sub(p2, p1), sub(p3, p1))
  const d4 = cross(sub(p2, p1), sub(p4, p1))
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** No self-intersections, no zero-length edges, non-zero area. O(n²), fine for rooms (< 50 vertices). */
export function isSimple(poly: Vec2[]) {
  const n = poly.length
  if (n < 3 || area(poly) < 1e-6) return false
  const es = edges(poly)
  if (es.some(([a, b]) => dist(a, b) < EPS)) return false
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue // neighbours share a vertex
      if (segsIntersect(es[i][0], es[i][1], es[j][0], es[j][1])) return false
    }
  return true
}

export function pointInPolygon(p: Vec2, poly: Vec2[]) {
  let inside = false
  for (const [a, b] of edges(poly))
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  return inside
}

/** Parameter t ∈ [0, 1] of the closest point on segment ab, plus that point. */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): { t: number; point: Vec2 } {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  const t = l2 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2)) : 0
  return { t, point: lerp(a, b, t) }
}

export const segDistance = (p: Vec2, a: Vec2, b: Vec2) => dist(p, projectOnSegment(p, a, b).point)

export function bbox(points: Vec2[]): { min: Vec2; max: Vec2 } {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  return { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] }
}

// ---------- derived walls ----------

export interface WallHost {
  roomId: string
  edge: number
}

export interface DerivedWall {
  a: Vec2 // centreline
  b: Vec2
  thickness: number
  exterior: boolean
  hosts: WallHost[]
}

interface RoomLike {
  id: string
  polygon: Vec2[] // CCW
}

/**
 * Walls from room edges. Collinear overlapping edges are merged: the overlap becomes one interior wall
 * centred on the line (shared by both rooms); the rest are exterior walls pushed outward so the room
 * polygon stays the inner face. Exterior walls are extended by their thickness at convex corners so
 * corners close. Tolerance 1 mm.
 */
export function deriveWalls(rooms: RoomLike[], interior: number, exterior: number): DerivedWall[] {
  type E = { a: Vec2; b: Vec2; host: WallHost; convexA: boolean; convexB: boolean }
  const all: E[] = []
  for (const r of rooms) {
    const n = r.polygon.length
    const convex = (i: number) => {
      const prev = r.polygon[(i - 1 + n) % n]
      const next = r.polygon[(i + 1) % n]
      return cross(sub(r.polygon[i], prev), sub(next, r.polygon[i])) > 0
    }
    edges(r.polygon).forEach(([a, b], i) => {
      if (dist(a, b) > EPS) all.push({ a, b, host: { roomId: r.id, edge: i }, convexA: convex(i), convexB: convex((i + 1) % n) })
    })
  }

  // Group by supporting line: canonical direction (angle in [0, π)) + signed offset.
  const groups: { dir: Vec2; origin: Vec2; list: E[] }[] = []
  for (const e of all) {
    let d = norm(sub(e.b, e.a))
    if (d[1] < -1e-9 || (Math.abs(d[1]) <= 1e-9 && d[0] < 0)) d = scale(d, -1)
    const g = groups.find(g => Math.abs(cross(g.dir, d)) < 1e-6 && Math.abs(cross(g.dir, sub(e.a, g.origin))) < EPS)
    if (g) g.list.push(e)
    else groups.push({ dir: d, origin: e.a, list: [e] })
  }

  const out: DerivedWall[] = []
  for (const g of groups) {
    const at = (p: Vec2) => dot(sub(p, g.origin), g.dir)
    const spans = g.list.map(e => {
      const [ta, tb] = [at(e.a), at(e.b)]
      return { e, lo: Math.min(ta, tb), hi: Math.max(ta, tb) }
    })
    const cuts = [...new Set(spans.flatMap(s => [s.lo, s.hi]).map(t => Math.round(t / EPS) * EPS))].sort((x, y) => x - y)
    // Elementary intervals → covering edges; merge neighbours with the same cover.
    let run: { lo: number; hi: number; cover: typeof spans } | null = null
    const flush = () => {
      if (!run) return
      const { lo, hi, cover } = run
      const p = (t: number) => add(g.origin, scale(g.dir, t))
      const hosts = cover.map(c => c.e.host)
      if (cover.length > 1) {
        out.push({ a: p(lo), b: p(hi), thickness: interior, exterior: false, hosts })
      } else {
        const e = cover[0].e
        const forward = at(e.b) > at(e.a)
        const shift = scale(rightNormal(sub(e.b, e.a)), exterior / 2)
        // Extend only where this piece ends at a convex polygon corner of its edge.
        const atA = Math.abs(lo - cover[0].lo) < EPS
        const atB = Math.abs(hi - cover[0].hi) < EPS
        const [convexLo, convexHi] = forward ? [e.convexA, e.convexB] : [e.convexB, e.convexA]
        const lo2 = lo - (atA && convexLo ? exterior : 0)
        const hi2 = hi + (atB && convexHi ? exterior : 0)
        out.push({ a: add(p(lo2), shift), b: add(p(hi2), shift), thickness: exterior, exterior: true, hosts })
      }
      run = null
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      const [lo, hi] = [cuts[i], cuts[i + 1]]
      const mid = (lo + hi) / 2
      const cover = spans.filter(s => s.lo < mid && mid < s.hi)
      const same = run && run.cover.length === cover.length && run.cover.every(c => cover.includes(c))
      if (same) run!.hi = hi
      else {
        flush()
        if (cover.length) run = { lo, hi, cover }
      }
    }
    flush()
  }
  return out
}

// ---------- openings along a wall ----------

export interface OpeningSpan {
  id: string
  center: number // distance from wall start
  width: number
}

export interface WallPart {
  from: number
  to: number
  openingId?: string
}

/** Split a wall of length L into solid parts and opening parts. Openings are clamped to the wall; overlaps are trimmed. */
export function wallSegments(L: number, openings: OpeningSpan[]): WallPart[] {
  const parts: WallPart[] = []
  let cursor = 0
  for (const o of [...openings].sort((a, b) => a.center - b.center)) {
    const from = Math.max(cursor, o.center - o.width / 2)
    const to = Math.min(L, o.center + o.width / 2)
    if (to - from < EPS) continue
    if (from - cursor > EPS) parts.push({ from: cursor, to: from })
    parts.push({ from, to, openingId: o.id })
    cursor = to
  }
  if (L - cursor > EPS) parts.push({ from: cursor, to: L })
  return parts
}
