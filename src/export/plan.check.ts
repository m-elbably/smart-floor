import assert from 'node:assert/strict'
import type { ProjectData } from '@/db/repo'
import { planDrawing, readableAngle } from './plan'
import { buildSvg } from './svg'
import { buildDxf } from './dxf'
import { buildSchedule } from './schedule'

const s = { wallInterior: 0.1, wallExterior: 0.2, slab: 0.2, units: 'metric' as const }
const data = {
  project: { id: 'p', name: 'T', description: '', thumbnail: null, site: null, createdAt: 0, updatedAt: 0 },
  floors: [{ id: 'f', projectId: 'p', name: 'Ground', level: 0, elevation: 0, height: 2.8, slab: 0.2 }],
  rooms: [{ id: 'r', floorId: 'f', name: 'Living & dining', kind: 'living', polygon: [[0, 0], [4, 0], [4, 3], [0, 3]], floorMaterial: 'wood', wallColor: '#fff', ceiling: true }],
  walls: [],
  openings: [{ id: 'o', floorId: 'f', host: { roomId: 'r', edge: 0 }, along: 2, kind: 'door', preset: 'single', width: 0.9, height: 2.1, sill: 0, props: {} }],
  stairs: [],
  zones: [],
  items: [{ id: 'i', floorId: 'f', catalogId: 'plant', x: 1, y: 1, z: 0, rotation: 0, scale: [1, 1, 1], variant: null, name: null }]
} as ProjectData

const d = planDrawing(data, 'f', s)
assert.equal(d.rooms.length, 1)
assert.equal(d.rooms[0].area, 12)
assert.equal(d.dims.length, 4, 'one dimension per exterior wall')
assert.equal(d.swings.length, 1, 'the door gets a swing arc')
// the door splits the bottom wall: 4 walls + 1 extra piece
assert.equal(d.walls.length, 5)
assert.equal(d.items.length, 1)
assert.equal(planDrawing(data, 'none', s).points.length, 0, 'an empty floor draws nothing')

// labels never read upside down
assert.equal(readableAngle([0, 0], [1, 0]), 0)
assert.equal(readableAngle([1, 0], [0, 0]), 0)
assert.equal(readableAngle([0, 0], [0, 1]), 90)
assert.equal(readableAngle([0, 1], [0, 0]), -90)

const svg = buildSvg(data, s, 'f')
assert.ok(svg.startsWith('<?xml') && svg.trimEnd().endsWith('</svg>'))
assert.ok(svg.includes('Living &amp; dining'), 'room names are escaped')
assert.ok(svg.includes('12.00 m²'))
assert.equal((svg.match(/<g /g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length)

const dxf = buildDxf({ ...data, rooms: [{ ...data.rooms[0], name: 'Salón' }] }, s, 'f').split('\n')
assert.equal(dxf.at(-1), '', 'ends with a newline')
const pairs = dxf.slice(0, -1)
assert.equal(pairs.length % 2, 0, 'group code / value pairs')
for (let i = 0; i < pairs.length; i += 2) assert.match(pairs[i], /^\d+$/, `group code at line ${i + 1}`)
const values = pairs.filter((_, i) => i % 2)
const count = (v: string) => values.filter(x => x === v).length
assert.equal(count('SECTION'), 3)
assert.equal(count('ENDSEC'), 3)
assert.equal(count('POLYLINE'), count('SEQEND'))
assert.equal(count('POLYLINE'), 1 + 5 + 1 + 1, 'room + wall pieces + item + swing')
assert.equal(values.at(-1), 'EOF')
assert.ok(values.includes('Sal\\U+00F3n'), 'non-ASCII is escaped')
assert.ok(values.includes('12.00 m2'))

const csv = buildSchedule({ ...data, items: [...data.items, { ...data.items[0], id: 'j' }] }, 'metric').split('\r\n')
assert.ok(csv[0].startsWith('\ufeff'))
assert.equal(csv[2], 'Ground,Living & dining,living,12,14,39.2,' + csv[2].split(',').at(-1), 'area, perimeter, wall area = 14 × 2.8')
assert.ok(csv.some(l => /^Ground,door,.*,0\.9,2\.1,1$/.test(l)))
assert.ok(csv.some(l => /^Ground,.*,2$/.test(l) && !l.includes('door')), 'two identical items are one line')
const ft = buildSchedule(data, 'imperial')
assert.ok(ft.includes('Area (ft²)') && ft.includes(',129.17,'), '12 m² ≈ 129.17 ft²')
console.log('plan exports ok')
