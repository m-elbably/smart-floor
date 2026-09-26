import assert from 'node:assert/strict'
import type { ProjectData } from '../db/repo'
import type { Opening, Room, Vec2 } from '../types'
import { refitOpenings, floorWalls, openingOnWall, fitAlong } from './model'

const room: Room = { id: 'r', floorId: 'f', name: 'A', kind: 'generic', polygon: [[0, 0], [4, 0], [4, 3], [0, 3]], floorMaterial: 'wood', wallColor: '#fff', ceiling: true }
const door: Opening = { id: 'o', floorId: 'f', host: { roomId: 'r', edge: 0 }, along: 2, kind: 'door', preset: 'single', width: 0.9, height: 2.1, sill: 0, props: {} }
const data = { floors: [{ id: 'f', height: 2.8 }], rooms: [room], walls: [], openings: [door] } as unknown as ProjectData
const refit = (poly: Vec2[]) => refitOpenings(data, room, poly, room.polygon)

assert.deepEqual(refit([[0, 0], [3, 0], [3, 3], [0, 3]]), [], 'still fits: unchanged')
const clamped = refit([[0, 0], [2, 0], [2, 3], [0, 3]])
assert.equal(clamped[0].patch!.along, 1.5, 'clamped to 2 − 0.45 − 0.05')
assert.equal(refit([[0, 0], [0.8, 0], [0.8, 3], [0, 3]])[0].patch, null, 'too short: removed')
const rehosted = refit([[0, 0], [1, 0], [4, 0], [4, 3], [0, 3]])
assert.deepEqual(rehosted[0].patch, { host: { roomId: 'r', edge: 1 }, along: 1 }, 'vertex inserted before it: moves to edge 1')

assert.equal(fitAlong(0, 0.9, 4), 0.5)
assert.equal(fitAlong(5, 0.9, 1), 0.5, "exact fit")
assert.equal(fitAlong(5, 0.9, 0.95), null)

// The door lands on the exterior wall piece of edge 0, at x = 2 (piece starts at −0.25 after the corner extension).
const walls = floorWalls(data, 'f', { wallInterior: 0.1, wallExterior: 0.25 })
const on = openingOnWall(data, door, walls)!
assert.ok(on.wall.hosts.some(h => h.roomId === 'r' && h.edge === 0))
assert.ok(Math.abs(on.center - 2.25) < 1e-9)
console.log('model ok')
