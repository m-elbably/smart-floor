import assert from 'node:assert/strict'
import type { ProjectData } from '../db/repo'
import { summary } from './summary'

const rect = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
const room = (id: string, floorId: string, polygon: [number, number][]) => ({ id, floorId, name: id, kind: 'generic', polygon, floorMaterial: 'wood', wallColor: '#fff', ceiling: true })
const data = {
  project: { site: rect(-5, -5, 20, 15) },
  floors: [
    { id: 'g', name: 'Ground Floor', level: 0 },
    { id: 'f1', name: '1st Floor', level: 1 }
  ],
  rooms: [room('A', 'g', rect(0, 0, 4, 3)), room('B', 'g', rect(4, 0, 3, 3)), room('C', 'f1', rect(0, 0, 5, 4))],
  openings: [{ kind: 'door' }, { kind: 'door' }, { kind: 'window' }],
  items: [{}, {}, {}],
  stairs: [{}]
} as unknown as ProjectData

const s = summary(data, { wallInterior: 0.15, wallExterior: 0.25 })
const near = (a: number, b: number, m: string) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`)
const [top, ground] = s.floors
// Hand calculation: ground = outer rectangle (7 + 2·0.25) × (3 + 2·0.25) = 7.5 × 3.5; net = 12 + 9
near(ground.gross, 7.5 * 3.5, 'ground gross')
near(ground.net, 21, 'ground net')
// 1st floor: 5.5 × 4.5 gross, 20 net
near(top.gross, 5.5 * 4.5, 'upper gross')
near(top.net, 20, 'upper net')
near(s.gross, 26.25 + 24.75, 'total gross')
near(s.net, 41, 'total net')
assert.deepEqual([s.doors, s.windows, s.items, s.stairs], [2, 1, 3, 1])
near(s.site!, 300, 'site')
assert.deepEqual(ground.rooms.map(r => [r.name, r.area]), [['A', 12], ['B', 9]])
console.log('summary ok')
