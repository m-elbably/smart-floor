import assert from 'node:assert/strict'
import { collide, onStair } from './walkmath'

const wall = { a: [0, 0] as [number, number], b: [4, 0] as [number, number], half: 0.1 }
// walking into a wall stops at r + half from its centreline
const p = collide([2, 0.2], [wall], 0.25)
assert.ok(Math.abs(p[1] - 0.35) < 1e-9 && Math.abs(p[0] - 2) < 1e-9)
// sliding: the along-wall component survives
const s = collide([3, 0.3], [wall], 0.25)
assert.equal(s[0], 3)
// a gap (two pieces with a door between 1.5 and 2.5) lets you through the middle
const pieces = [{ a: [0, 0] as [number, number], b: [1.5, 0] as [number, number], half: 0.1 }, { a: [2.5, 0] as [number, number], b: [4, 0] as [number, number], half: 0.1 }]
assert.deepEqual(collide([2, 0], pieces, 0.25), [2, 0], 'door gap is passable')
// corner: pushed out of both walls
const corner = collide([0.1, 0.1], [wall, { a: [0, 0], b: [0, 4], half: 0.1 }], 0.25)
assert.ok(corner[0] >= 0.35 - 1e-9 && corner[1] >= 0.35 - 1e-9)

// stairs: halfway up a straight run → half the rise, and past halfway you're on the upper floor
const run = { footprint: [[-0.5, 0], [0.5, 0], [0.5, 4], [-0.5, 4]] as [number, number][], walk: [[0, 0], [0, 4]] as [number, number][], base: 0, rise: 3, lowerFloorId: 'g', upperFloorId: 'f1' }
assert.deepEqual(onStair([0, 1], [run]), { z: 0.75, floorId: 'g' })
assert.deepEqual(onStair([0.2, 3], [run]), { z: 2.25, floorId: 'f1' })
assert.equal(onStair([2, 2], [run]), null)
console.log('walkmath ok')
