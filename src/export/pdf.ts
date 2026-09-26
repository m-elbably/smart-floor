// Printable vector plan (FR-112), drawn from the store — not a screenshot — so it prints to scale.
import { jsPDF } from 'jspdf'
import type { ProjectData } from '@/db/repo'
import type { Vec2 } from '@/types'
import { add, bbox, centroid, dist, norm, scale, sub, wallSegments, area } from '@/editor/geometry'
import { floorWalls, hostLine, openingOnWall, openingFrame, doorLeaves, swingArc, wallDimensions } from '@/editor/model'
import { solve, toPlan } from '@/editor/stairs'
import { stairRise } from '@/editor/model'
import { itemFootprint } from '@/catalog'
import { summary } from '@/editor/summary'
import { ZONE_KINDS } from '@/editor/presets'
import { format, formatArea, type Units } from '@/editor/units'
import { pageTransform, PAPER, MARGIN, TITLE_H, type Paper, type PlanScale } from './layout'

export interface PdfOptions {
  paper: Paper
  orientation: 'portrait' | 'landscape'
  scale: PlanScale
  floors: 'active' | 'all'
}

interface Settings {
  units: Units
  wallInterior: number
  wallExterior: number
  slab: number
}

/** Light tint of a hex colour for print fills. */
const tint = (hex: string, k = 0.55) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * k))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

export function buildPdf(data: ProjectData, s: Settings, opts: PdfOptions, activeFloorId: string): { bytes: Uint8Array; warnings: string[] } {
  const [pw, ph] = opts.orientation === 'landscape' ? [...PAPER[opts.paper]].reverse() : PAPER[opts.paper]
  const doc = new jsPDF({ unit: 'mm', format: opts.paper, orientation: opts.orientation })
  const warnings: string[] = []
  const sum = summary(data, s)
  const floors = [...data.floors].sort((a, b) => a.level - b.level).filter(f => opts.floors === 'all' || f.id === activeFloorId)

  floors.forEach((floor, page) => {
    if (page) doc.addPage(opts.paper, opts.orientation)
    const rooms = data.rooms.filter(r => r.floorId === floor.id)
    const walls = floorWalls(data, floor.id, s)
    const zones = data.zones.filter(z => z.floorId === floor.id)
    const stairs = data.stairs.filter(st => st.floorId === floor.id)
    const items = data.items.filter(i => i.floorId === floor.id)
    const pts: Vec2[] = [
      ...rooms.flatMap(r => r.polygon),
      ...walls.flatMap(w => [w.a, w.b]),
      ...zones.flatMap(z => z.polygon),
      ...stairs.flatMap(st => toPlan(st, solve(st.kind, st.params, stairRise(data, st.floorId, s.slab)).footprint)),
      ...items.flatMap(i => itemFootprint(i))
    ]
    if (!pts.length) {
      doc.setFontSize(12).setTextColor('#71717a').text('This floor is empty.', pw / 2, ph / 2, { align: 'center' })
      return
    }
    const bb = bbox(pts)
    const pad = 1 // room for dimension lines
    const T = pageTransform(sub(bb.min, [pad, pad]), add(bb.max, [pad, pad]), pw, ph, opts.scale)
    if (!T.fixedFits) warnings.push(`${floor.name} doesn't fit at 1:${opts.scale} on ${opts.paper.toUpperCase()}; printed to fit (≈1:${Math.round(T.denominator)}).`)
    const P = (p: Vec2) => T.map(p)
    const poly = (points: Vec2[], style: 'F' | 'S' | 'FD') => {
      const m = points.map(P)
      doc.lines(m.slice(1).map((q, i) => [q[0] - m[i][0], q[1] - m[i][1]]), m[0][0], m[0][1], [1, 1], style, true)
    }
    const line = (a: Vec2, b: Vec2) => {
      const [p, q] = [P(a), P(b)]
      doc.line(p[0], p[1], q[0], q[1])
    }
    const polyline = (points: Vec2[]) => points.slice(1).forEach((q, i) => line(points[i], q))

    // Garden zones, then room floors.
    for (const z of zones) (doc.setFillColor(tint(ZONE_KINDS[z.kind]?.color ?? '#7fb069')), poly(z.polygon, 'F'))
    doc.setFillColor('#f4f1ea')
    for (const r of rooms) poly(r.polygon, 'F')

    // Furniture and stairs as thin outlines.
    doc.setLineWidth(0.15).setDrawColor('#a1a1aa')
    for (const i of items) poly(itemFootprint(i), 'S')
    doc.setDrawColor('#52525b')
    for (const st of stairs) {
      const sol = solve(st.kind, st.params, stairRise(data, st.floorId, s.slab))
      for (const tr of sol.treads) poly(toPlan(st, tr.poly), 'S')
      polyline(toPlan(st, sol.walk))
    }

    // Walls cut by openings.
    const placed = data.openings.filter(o => o.floorId === floor.id).flatMap(o => {
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
      const mine = placed.filter(p => p.on.wall.key === w.key)
      for (const part of wallSegments(L, mine.map(p => ({ id: p.o.id, center: p.on.center, width: p.o.width })))) {
        const h = w.thickness / 2
        if (!part.openingId) {
          doc.setFillColor(w.kind === 'fence' ? '#8b6b4a' : '#3f3f46')
          poly([at(part.from, -h), at(part.to, -h), at(part.to, h), at(part.from, h)], 'F')
          continue
        }
        const p = mine.find(m => m.o.id === part.openingId)!
        doc.setDrawColor('#27272a').setLineWidth(0.18)
        line(at(part.from, -h), at(part.from, h))
        line(at(part.to, -h), at(part.to, h))
        if (p.o.kind === 'window') for (const off of [-h, 0, h]) line(at(part.from, off), at(part.to, off))
        else
          for (const leaf of doorLeaves(p.o, w, part.from, part.to, p.inward, p.hingeAtStart)) {
            polyline(swingArc(leaf))
            line(leaf.hinge, add(leaf.hinge, scale(leaf.into, leaf.width)))
          }
      }
    }

    // Dimensions along exterior walls.
    doc.setDrawColor('#71717a').setLineWidth(0.1).setTextColor('#3f3f46').setFontSize(6.5)
    for (const d of wallDimensions(data, floor.id, s, 0.55)) {
      line(d.a, d.b)
      for (const [a, b] of d.ext) line(a, b)
      // label sits between the wall and its dimension line, centred on both axes
      const n = norm(sub(d.ext[0][1], d.ext[0][0]))
      const [x, y] = P(sub(scale(add(d.a, d.b), 0.5), scale(n, 0.25)))
      const ang = (Math.atan2(-(d.b[1] - d.a[1]), d.b[0] - d.a[0]) * 180) / Math.PI
      const up = ang > 90 || ang < -90 ? ang + 180 : ang // keep text readable
      doc.text(format(d.length, s.units), x, y, { align: 'center', baseline: 'middle', angle: -up })
    }

    // Room names + areas.
    doc.setTextColor('#18181b')
    for (const r of rooms) {
      const [x, y] = P(centroid(r.polygon))
      doc.setFont('helvetica', 'bold').setFontSize(8).text(r.name, x, y, { align: 'center' })
      doc.setFont('helvetica', 'normal').setFontSize(7).text(formatArea(area(r.polygon), s.units), x, y + 3.2, { align: 'center' })
    }

    titleBlock(floor.name, T)
  })

  function titleBlock(floorName: string, T: ReturnType<typeof pageTransform>) {
    const bw = 92
    const [x, y] = [pw - MARGIN - bw, ph - MARGIN - TITLE_H + 4]
    doc.setDrawColor('#27272a').setLineWidth(0.3).rect(x, y, bw, TITLE_H - 4)
    doc.setTextColor('#18181b').setFont('helvetica', 'bold').setFontSize(11).text(data.project.name, x + 3, y + 6)
    doc.setFont('helvetica', 'normal').setFontSize(8)
    const fs = sum.floors.find(f => f.name === floorName)
    doc.text(`${floorName}${fs ? ` · gross ${formatArea(fs.gross, s.units)} · net ${formatArea(fs.net, s.units)}` : ''}`, x + 3, y + 11)
    const scaleText = opts.scale !== 'fit' && T.fixedFits ? `Scale 1:${opts.scale}` : `Scale ~1:${Math.round(T.denominator)} (fit to page)`
    doc.text(`${scaleText} · ${opts.paper.toUpperCase()}`, x + 3, y + 15.5)
    doc.setTextColor('#71717a').text(new Date().toLocaleDateString(), x + bw - 3, y + 6, { align: 'right' })
    doc.text('Smart Floor', x + bw - 3, y + 15.5, { align: 'right' })

    // Scale bar: a round number of metres about 40 mm long.
    const m = [1, 2, 5, 10, 20, 50].find(v => v * T.k >= 30) ?? 50
    const [sx, sy] = [MARGIN, ph - MARGIN - 6]
    const seg = (m * T.k) / 5
    doc.setLineWidth(0.2).setDrawColor('#27272a')
    for (let i = 0; i < 5; i++) {
      doc.setFillColor(i % 2 ? '#ffffff' : '#27272a')
      doc.rect(sx + i * seg, sy, seg, 1.6, 'FD')
    }
    doc.setTextColor('#27272a').setFontSize(7).text('0', sx, sy + 5).text(`${m} m`, sx + 5 * seg, sy + 5, { align: 'center' })
  }

  return { bytes: new Uint8Array(doc.output('arraybuffer')), warnings }
}
