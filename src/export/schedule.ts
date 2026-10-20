// Quantities as CSV (rooms, doors and windows, furniture) to price a project in a spreadsheet.
import type { ProjectData } from '@/db/repo'
import { area, edges, dist } from '@/editor/geometry'
import { FLOOR_MATERIALS, DOOR_PRESETS, WINDOW_PRESETS } from '@/editor/presets'
import { catalogItem } from '@/catalog'
import type { Units } from '@/editor/units'

const FT = 0.3048

/** RFC 4180 field: quoted when it holds a comma, quote or line break. */
const cell = (v: string | number) => (typeof v === 'number' ? String(v) : /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const row = (...v: (string | number)[]) => v.map(cell).join(',')

export function buildSchedule(data: ProjectData, units: Units): string {
  const [L, A, lu, au] = units === 'metric' ? [1, 1, 'm', 'm²'] : [1 / FT, 1 / FT ** 2, 'ft', 'ft²']
  const r2 = (v: number) => Math.round(v * 100) / 100
  const floors = [...data.floors].sort((a, b) => a.level - b.level)
  const floorName = new Map(floors.map(f => [f.id, f.name]))
  const out: string[] = []

  out.push(row('Rooms'), row('Floor', 'Room', 'Type', `Area (${au})`, `Perimeter (${lu})`, `Wall area, gross (${au})`, 'Floor finish'))
  for (const f of floors)
    for (const r of data.rooms.filter(r => r.floorId === f.id)) {
      const perim = edges(r.polygon).reduce((t, [a, b]) => t + dist(a, b), 0)
      const walls = r.kind === 'outdoor' ? 0 : perim * f.height
      out.push(row(f.name, r.name, r.kind, r2(area(r.polygon) * A), r2(perim * L), r2(walls * A), FLOOR_MATERIALS[r.floorMaterial]?.label ?? r.floorMaterial))
    }

  // identical openings on a floor are one line
  const tally = <T>(list: T[], key: (t: T) => string) => {
    const m = new Map<string, { first: T; n: number }>()
    for (const t of list) {
      const k = key(t)
      const e = m.get(k)
      e ? e.n++ : m.set(k, { first: t, n: 1 })
    }
    return [...m.values()]
  }

  out.push('', row('Doors and windows'), row('Floor', 'Kind', 'Type', `Width (${lu})`, `Height (${lu})`, 'Count'))
  for (const { first: o, n } of tally(data.openings, o => [o.floorId, o.kind, o.preset, o.width, o.height].join('|'))) {
    const label = (o.kind === 'door' ? DOOR_PRESETS : WINDOW_PRESETS)[o.preset]?.label ?? o.preset
    out.push(row(floorName.get(o.floorId) ?? '', o.kind, label, r2(o.width * L), r2(o.height * L), n))
  }

  out.push('', row('Furniture and garden items'), row('Floor', 'Item', 'Variant', 'Category', 'Count'))
  for (const { first: i, n } of tally(data.items, i => [i.floorId, i.catalogId, i.variant].join('|'))) {
    const def = catalogItem(i.catalogId)
    const variant = def?.variants?.find(v => v.id === i.variant)?.name ?? def?.variants?.[0]?.name ?? ''
    out.push(row(floorName.get(i.floorId) ?? '', def?.name ?? i.catalogId, variant, def?.category ?? '', n))
  }

  return '\ufeff' + out.join('\r\n') + '\r\n' // BOM: Excel otherwise misreads m² as Latin-1
}
