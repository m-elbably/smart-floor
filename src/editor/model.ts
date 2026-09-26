// Read-only views over the project data that several places need: derived walls, opening placement,
// snap targets. Pure functions of (data, settings) — recomputed on demand, plans are small.
import type { ProjectData } from '@/db/repo'
import type { Opening, OpeningHost, Room, Vec2 } from '@/types'
import { deriveWalls, dist, lerp, edges, dot, sub, norm, type WallHost, projectOnSegment, segDistance, EPS } from './geometry'

export interface WallView {
  key: string
  a: Vec2 // centreline
  b: Vec2
  thickness: number
  height: number
  color: string
  kind: 'wall' | 'fence'
  hosts: WallHost[] // room edges this wall stands on (empty for free walls)
  wallId?: string // free-standing wall
  /** Entity that is selected when the wall is clicked. */
  ownerId: string
}

export const OPENING_MARGIN = 0.05

export function floorWalls(data: ProjectData, floorId: string, s: { wallInterior: number; wallExterior: number }): WallView[] {
  const floor = data.floors.find(f => f.id === floorId)
  const height = floor?.height ?? 2.8
  const rooms = data.rooms.filter(r => r.floorId === floorId)
  const byId = new Map(rooms.map(r => [r.id, r]))
  const derived = deriveWalls(rooms, s.wallInterior, s.wallExterior).map((w, i) => ({
    key: `d${i}`,
    a: w.a,
    b: w.b,
    thickness: w.thickness,
    height,
    color: byId.get(w.hosts[0].roomId)?.wallColor ?? '#f2efe9',
    kind: 'wall' as const,
    hosts: w.hosts,
    ownerId: w.hosts[0].roomId
  }))
  const free = data.walls
    .filter(w => w.floorId === floorId)
    .map(w => ({ key: w.id, a: w.a, b: w.b, thickness: w.thickness, height: w.height, color: '#f2efe9', kind: w.kind, hosts: [], wallId: w.id, ownerId: w.id }))
  return [...derived, ...free]
}

/** The line an opening's `along` is measured on: its room edge (start → end) or free wall (a → b). */
export function hostLine(data: ProjectData, host: OpeningHost): [Vec2, Vec2] | null {
  if ('wallId' in host) {
    const w = data.walls.find(w => w.id === host.wallId)
    return w ? [w.a, w.b] : null
  }
  const r = data.rooms.find(r => r.id === host.roomId)
  return r ? (edges(r.polygon)[host.edge] ?? null) : null
}

export const sameHost = (a: OpeningHost, b: OpeningHost) =>
  'wallId' in a ? 'wallId' in b && a.wallId === b.wallId : 'roomId' in b && a.roomId === b.roomId && a.edge === b.edge

/** Opening centre in plan coordinates. */
export function openingPoint(data: ProjectData, o: Pick<Opening, 'host' | 'along'>): Vec2 | null {
  const line = hostLine(data, o.host)
  if (!line) return null
  const L = dist(line[0], line[1])
  return lerp(line[0], line[1], L ? o.along / L : 0)
}

/** The wall piece carrying an opening and the opening centre's distance from that wall's start. */
export function openingOnWall(data: ProjectData, o: Pick<Opening, 'host' | 'along'>, walls: WallView[]) {
  const c = openingPoint(data, o)
  if (!c) return null
  const candidates = walls.filter(w => ('wallId' in o.host ? w.wallId === o.host.wallId : w.hosts.some(h => sameHost(h, o.host))))
  let best: { wall: WallView; center: number } | null = null
  let bd = Infinity
  for (const w of candidates) {
    const d = segDistance(c, w.a, w.b)
    if (d < bd) (bd = d), (best = { wall: w, center: dot(sub(c, w.a), norm(sub(w.b, w.a))) })
  }
  return best
}

/** Clamp `along` so an opening of `width` fits on a host edge of length L, or null if it cannot fit. */
export function fitAlong(along: number, width: number, L: number): number | null {
  const lo = width / 2 + OPENING_MARGIN
  const hi = L - width / 2 - OPENING_MARGIN
  if (hi < lo - EPS) return null
  return Math.min(hi, Math.max(lo, along))
}

/**
 * After a room polygon change, where each of its openings goes: same edge with a clamped `along`, or
 * re-hosted onto the nearest new edge when the vertex count changed, or null when it no longer fits.
 */
export function refitOpenings(data: ProjectData, room: Room, poly: Vec2[], oldPoly: Vec2[]) {
  const sameTopology = poly.length === oldPoly.length
  const newEdges = edges(poly)
  const out: { opening: Opening; patch: Partial<Opening> | null }[] = []
  for (const o of data.openings) {
    if (!('roomId' in o.host) || o.host.roomId !== room.id) continue
    let edge = o.host.edge
    let along = o.along
    if (!sameTopology) {
      const old = edges(oldPoly)[edge]
      if (!old) continue
      const c = lerp(old[0], old[1], o.along / (dist(old[0], old[1]) || 1))
      edge = newEdges.reduce((bi, e, i) => (segDistance(c, e[0], e[1]) < segDistance(c, newEdges[bi][0], newEdges[bi][1]) ? i : bi), 0)
      const e = newEdges[edge]
      along = projectOnSegment(c, e[0], e[1]).t * dist(e[0], e[1])
    }
    const e = newEdges[edge]
    const fit = e ? fitAlong(along, o.width, dist(e[0], e[1])) : null
    if (fit === null) out.push({ opening: o, patch: null })
    else if (edge !== o.host.edge || Math.abs(fit - o.along) > 1e-9) out.push({ opening: o, patch: { host: { roomId: room.id, edge }, along: fit } })
  }
  return out
}

/** Snap targets on a floor: room vertices, free wall ends, and room edges + free wall centrelines. */
export function snapTargets(data: ProjectData, floorId: string, skip?: { roomId: string; vertex: number }) {
  const vertices: Vec2[] = []
  const segments: [Vec2, Vec2][] = []
  for (const r of data.rooms) {
    if (r.floorId !== floorId) continue
    r.polygon.forEach((p, i) => {
      if (!(skip && skip.roomId === r.id && skip.vertex === i)) vertices.push(p)
    })
    edges(r.polygon).forEach((e, i) => {
      const n = r.polygon.length
      if (!(skip && skip.roomId === r.id && (i === skip.vertex || (i + 1) % n === skip.vertex))) segments.push(e)
    })
  }
  for (const w of data.walls) if (w.floorId === floorId) (vertices.push(w.a, w.b), segments.push([w.a, w.b]))
  return { vertices, segments }
}
