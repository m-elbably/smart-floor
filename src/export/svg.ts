// Scalable plan of one floor (SVG) for browsers, Inkscape or Illustrator. Printed at its stated size it is 1:100.
import type { ProjectData } from '@/db/repo'
import type { Vec2 } from '@/types'
import { bbox } from '@/editor/geometry'
import { format, formatArea, type Units } from '@/editor/units'
import { planDrawing, type PlanSettings } from './plan'

const esc = (t: string) => t.replace(/[&<>"]/g, c => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`)
const n = (v: number) => +v.toFixed(3)

export function buildSvg(data: ProjectData, s: PlanSettings & { units: Units }, floorId: string): string {
  const d = planDrawing(data, floorId, s)
  const { min, max } = bbox(d.points.length ? d.points : [[0, 0], [1, 1]])
  const pad = 1 // room for dimension lines
  const [x0, y1] = [min[0] - pad, max[1] + pad]
  const [w, h] = [n(max[0] - min[0] + 2 * pad), n(max[1] - min[1] + 2 * pad)]
  // viewBox units are metres; y flips so north is up
  const P = ([x, y]: Vec2) => `${n(x - x0)},${n(y1 - y)}`
  const pts = (p: Vec2[]) => p.map(P).join(' ')
  const poly = (p: Vec2[], attrs = '') => `<polygon points="${pts(p)}"${attrs}/>`
  const line = ([a, b]: [Vec2, Vec2]) => `<polyline points="${pts([a, b])}"/>`
  const text = (at: Vec2, t: string, angle = 0, attrs = '') => {
    const [x, y] = P(at).split(',')
    return `<text x="${x}" y="${y}"${angle ? ` transform="rotate(${n(-angle)} ${x} ${y})"` : ''}${attrs}>${esc(t)}</text>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${n(w * 10)}mm" height="${n(h * 10)}mm" font-family="Helvetica, Arial, sans-serif" text-anchor="middle">
<rect width="100%" height="100%" fill="#ffffff"/>
<g id="zones" stroke="none">${d.zones.map(z => poly(z.poly, ` fill="${z.color}" fill-opacity="0.45"`)).join('')}</g>
<g id="rooms" fill="#f4f1ea" stroke="none">${d.rooms.map(r => poly(r.poly)).join('')}</g>
<g id="furniture" fill="none" stroke="#a1a1aa" stroke-width="0.015">${d.items.map(i => poly(i)).join('')}</g>
<g id="stairs" fill="none" stroke="#52525b" stroke-width="0.015">${d.treads.map(t => poly(t)).join('')}${d.walkLines.map(l => `<polyline points="${pts(l)}"/>`).join('')}</g>
<g id="walls" stroke="none">${d.walls.map(wl => poly(wl.poly, ` fill="${wl.fence ? '#8b6b4a' : '#3f3f46'}"`)).join('')}</g>
<g id="openings" fill="none" stroke="#27272a" stroke-width="0.018">${d.openingLines.map(line).join('')}${d.swings.map(a => `<polyline points="${pts(a)}"/>`).join('')}</g>
<g id="dimensions" fill="#3f3f46" stroke="#71717a" stroke-width="0.01" font-size="0.2" dominant-baseline="middle">${d.dims
    .map(dim => [line([dim.a, dim.b]), ...dim.ext.map(line), text(dim.at, format(dim.length, s.units), dim.angle, ' stroke="none"')].join(''))
    .join('')}</g>
<g id="labels" fill="#18181b">${d.rooms
    .map(r => text(r.at, r.name, 0, ' font-size="0.28" font-weight="bold"') + text([r.at[0], r.at[1] - 0.32], formatArea(r.area, s.units), 0, ' font-size="0.22"'))
    .join('')}</g>
</svg>
`
}
