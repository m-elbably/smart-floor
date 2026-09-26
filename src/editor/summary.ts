// Areas and counts for the summary panel and the PDF title block.
import type { ProjectData } from '@/db/repo'
import { area, deriveWalls, dist } from './geometry'

export interface FloorSummary {
  id: string
  name: string
  /** Inside the outer faces of the exterior walls (rooms + exterior walls; interior walls sit inside rooms). */
  gross: number
  /** Sum of room polygons. */
  net: number
  rooms: { id: string; name: string; area: number }[]
}

export function summary(data: ProjectData, s: { wallInterior: number; wallExterior: number }) {
  const floors: FloorSummary[] = [...data.floors]
    .sort((a, b) => b.level - a.level)
    .map(f => {
      const rooms = data.rooms.filter(r => r.floorId === f.id).map(r => ({ id: r.id, name: r.name, area: area(r.polygon) }))
      const net = rooms.reduce((t, r) => t + r.area, 0)
      let walls = 0
      for (const w of deriveWalls(data.rooms.filter(r => r.floorId === f.id), s.wallInterior, s.wallExterior)) {
        if (!w.exterior) continue
        // extended corner pieces overlap their neighbour in a t × t square: count it once
        walls += dist(w.a, w.b) * w.thickness - (w.extended * w.thickness ** 2) / 2
      }
      return { id: f.id, name: f.name, gross: rooms.length ? net + walls : 0, net, rooms }
    })
  const count = (k: 'door' | 'window') => data.openings.filter(o => o.kind === k).length
  return {
    floors,
    gross: floors.reduce((t, f) => t + f.gross, 0),
    net: floors.reduce((t, f) => t + f.net, 0),
    doors: count('door'),
    windows: count('window'),
    items: data.items.length,
    stairs: data.stairs.length,
    site: data.project.site ? area(data.project.site) : null
  }
}
