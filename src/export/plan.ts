// One floor of the plan as world-space shapes (metres, y = north), shared by the PDF, SVG and DXF exports.
import type { ProjectData } from '@/db/repo'
import type { Vec2 } from '@/types'
import { add, area, centroid, dist, norm, scale, sub, wallSegments } from '@/editor/geometry'
import { floorWalls, hostLine, openingOnWall, openingFrame, doorLeaves, swingArc, wallDimensions, stairRise } from '@/editor/model'
import { solve, toPlan } from '@/editor/stairs'
import { itemFootprint } from '@/catalog'
import { ZONE_KINDS } from '@/editor/presets'

export interface PlanSettings {
  wallInterior: number
  wallExterior: number
  slab: number
}

export interface PlanDrawing {
  zones: { poly: Vec2[]; color: string }[]
  rooms: { poly: Vec2[]; name: string; area: number; at: Vec2 }[]
  items: Vec2[][]
  treads: Vec2[][]
  walkLines: Vec2[][]
  walls: { poly: Vec2[]; fence: boolean }[]
  /** door jambs, window panes and door leaves */
  openingLines: [Vec2, Vec2][]
  swings: Vec2[][]
  dims: { a: Vec2; b: Vec2; ext: [Vec2, Vec2][]; length: number; at: Vec2; angle: number }[]
  /** every point drawn, for the bounding box */
  points: Vec2[]
}

/** Text angle in degrees (counter-clockwise) along a→b, flipped so it never reads upside down. */
export function readableAngle(a: Vec2, b: Vec2) {
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  return ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang
}

export function planDrawing(data: ProjectData, floorId: string, s: PlanSettings): PlanDrawing {
  const rooms = data.rooms.filter(r => r.floorId === floorId)
  const walls = floorWalls(data, floorId, s)
  const zones = data.zones.filter(z => z.floorId === floorId)
  const items = data.items.filter(i => i.floorId === floorId).map(i => itemFootprint(i))
  const out: PlanDrawing = {
    zones: zones.map(z => ({ poly: z.polygon, color: ZONE_KINDS[z.kind]?.color ?? '#7fb069' })),
    rooms: rooms.map(r => ({ poly: r.polygon, name: r.name, area: area(r.polygon), at: centroid(r.polygon) })),
    items,
    treads: [],
    walkLines: [],
    walls: [],
    openingLines: [],
    swings: [],
    dims: [],
    points: []
  }

  for (const st of data.stairs.filter(st => st.floorId === floorId)) {
    const sol = solve(st.kind, st.params, stairRise(data, st.floorId, s.slab))
    out.treads.push(...sol.treads.map(tr => toPlan(st, tr.poly)))
    out.walkLines.push(toPlan(st, sol.walk))
    out.points.push(...toPlan(st, sol.footprint))
  }

  // Walls cut by openings.
  const placed = data.openings.filter(o => o.floorId === floorId).flatMap(o => {
    const on = openingOnWall(data, o, walls)
    const hl = hostLine(data, o.host)
    return on && hl ? [{ o, on, ...openingFrame(hl[0], hl[1], on.wall) }] : []
  })
  for (const w of walls) {
    const L = dist(w.a, w.b)
    if (L < 1e-3) continue
    const dir = norm(sub(w.b, w.a))
    const n: Vec2 = [-dir[1], dir[0]]
    const at = (t: number, off = 0) => add(add(w.a, scale(dir, t)), scale(n, off))
    const h = w.thickness / 2
    const mine = placed.filter(p => p.on.wall.key === w.key)
    for (const part of wallSegments(L, mine.map(p => ({ id: p.o.id, center: p.on.center, width: p.o.width })))) {
      if (!part.openingId) {
        out.walls.push({ poly: [at(part.from, -h), at(part.to, -h), at(part.to, h), at(part.from, h)], fence: w.kind === 'fence' })
        continue
      }
      const p = mine.find(m => m.o.id === part.openingId)!
      out.openingLines.push([at(part.from, -h), at(part.from, h)], [at(part.to, -h), at(part.to, h)])
      if (p.o.kind === 'window') for (const off of [-h, 0, h]) out.openingLines.push([at(part.from, off), at(part.to, off)])
      else
        for (const leaf of doorLeaves(p.o, w, part.from, part.to, p.inward, p.hingeAtStart)) {
          out.swings.push(swingArc(leaf))
          out.openingLines.push([leaf.hinge, add(leaf.hinge, scale(leaf.into, leaf.width))])
        }
    }
  }

  // Dimensions along exterior walls; the label sits between the wall and its dimension line.
  for (const d of wallDimensions(data, floorId, s, 0.55)) {
    const n = norm(sub(d.ext[0][1], d.ext[0][0]))
    out.dims.push({ ...d, at: sub(scale(add(d.a, d.b), 0.5), scale(n, 0.25)), angle: readableAngle(d.a, d.b) })
  }

  out.points.push(
    ...rooms.flatMap(r => r.polygon),
    ...walls.flatMap(w => [w.a, w.b]),
    ...zones.flatMap(z => z.polygon),
    ...items.flat()
  )
  return out
}
