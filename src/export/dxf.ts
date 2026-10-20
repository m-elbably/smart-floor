// One floor as an AutoCAD R12 DXF (plain ASCII, metres) for LibreCAD, AutoCAD, FreeCAD and SketchUp.
// Everything is outlines on named layers; R12 has no fills, which CAD users expect anyway.
import type { ProjectData } from '@/db/repo'
import type { Vec2 } from '@/types'
import { format, formatArea, type Units } from '@/editor/units'
import { planDrawing, type PlanSettings } from './plan'

// name → AutoCAD colour index
const LAYERS = { WALLS: 7, OPENINGS: 4, ROOMS: 8, ZONES: 3, FURNITURE: 9, STAIRS: 5, DIMENSIONS: 1, LABELS: 7 }
type Layer = keyof typeof LAYERS

/** R12 text is 8-bit: m² becomes m2 (no CAD font has it everywhere); anything else non-ASCII goes as \U+XXXX, which AutoCAD and LibreCAD decode. */
const dxfText = (t: string) => [...t.replace(/²/g, '2')].map(c => (c.charCodeAt(0) < 128 ? c : `\\U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)).join('')

export function buildDxf(data: ProjectData, s: PlanSettings & { units: Units }, floorId: string): string {
  const d = planDrawing(data, floorId, s)
  const out: (string | number)[] = []
  const g = (...pairs: (string | number)[]) => out.push(...pairs)
  const num = (v: number) => +v.toFixed(4)

  const polyline = (layer: Layer, p: Vec2[], closed: boolean) => {
    g(0, 'POLYLINE', 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, closed ? 1 : 0)
    for (const [x, y] of p) g(0, 'VERTEX', 8, layer, 10, num(x), 20, num(y), 30, 0)
    g(0, 'SEQEND', 8, layer)
  }
  const line = (layer: Layer, [a, b]: [Vec2, Vec2]) => g(0, 'LINE', 8, layer, 10, num(a[0]), 20, num(a[1]), 30, 0, 11, num(b[0]), 21, num(b[1]), 31, 0)
  // centred on `at` both ways (72 = 1 centre, 73 = 2 middle)
  const text = (layer: Layer, at: Vec2, t: string, height: number, angle = 0) =>
    g(0, 'TEXT', 8, layer, 10, num(at[0]), 20, num(at[1]), 30, 0, 40, height, 1, dxfText(t), 50, num(angle), 72, 1, 11, num(at[0]), 21, num(at[1]), 31, 0, 73, 2)

  g(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC')
  g(0, 'SECTION', 2, 'TABLES')
  g(0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0, 0, 'ENDTAB')
  g(0, 'TABLE', 2, 'LAYER', 70, Object.keys(LAYERS).length)
  for (const [name, color] of Object.entries(LAYERS)) g(0, 'LAYER', 2, name, 70, 0, 62, color, 6, 'CONTINUOUS')
  g(0, 'ENDTAB', 0, 'ENDSEC')

  g(0, 'SECTION', 2, 'ENTITIES')
  for (const z of d.zones) polyline('ZONES', z.poly, true)
  for (const r of d.rooms) {
    polyline('ROOMS', r.poly, true)
    text('LABELS', r.at, r.name, 0.25)
    text('LABELS', [r.at[0], r.at[1] - 0.32], formatArea(r.area, s.units), 0.18)
  }
  for (const i of d.items) polyline('FURNITURE', i, true)
  for (const t of d.treads) polyline('STAIRS', t, true)
  for (const l of d.walkLines) polyline('STAIRS', l, false)
  for (const w of d.walls) polyline('WALLS', w.poly, true)
  for (const l of d.openingLines) line('OPENINGS', l)
  for (const a of d.swings) polyline('OPENINGS', a, false)
  for (const dim of d.dims) {
    line('DIMENSIONS', [dim.a, dim.b])
    for (const e of dim.ext) line('DIMENSIONS', e)
    text('DIMENSIONS', dim.at, format(dim.length, s.units), 0.18, dim.angle)
  }
  g(0, 'ENDSEC', 0, 'EOF')

  // group code and value each on their own line
  return out.join('\n') + '\n'
}
