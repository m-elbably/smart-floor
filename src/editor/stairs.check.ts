import assert from 'node:assert/strict'
import { solve, comfortWarnings, defaultSteps, toPlan, clipConvex, stairwellHoles } from './stairs'
import { area } from './geometry'
import type { Vec2 } from '../types'

const near = (a: number, b: number, m = '') => assert.ok(Math.abs(a - b) < 1e-6, `${m} ${a} ≠ ${b}`)
const P = { width: 1, going: 0.27 }

// straight: 17 risers over 3.0 m → comfortable; last tread one rise below the floor above
const s = solve('straight', { ...P, steps: 17 }, 3.0)
near(s.rise, 3 / 17)
assert.equal(s.treads.length, 16)
near(s.treads.at(-1)!.top + s.rise, 3.0, 'reaches the floor above exactly')
near(s.runLength, 16 * 0.27)
near(area(s.footprint), 1 * 16 * 0.27)
assert.deepEqual(s.warnings, [])
assert.equal(defaultSteps(3.0), 17)

// 12 steps over 3.0 m → 25 cm rise: too steep, stride too long
const steep = solve('straight', { ...P, steps: 12 }, 3.0)
assert.deepEqual(steep.warnings.map(w => w.code), ['rise', 'stride'])
assert.deepEqual(comfortWarnings(0.17, 0.22).map(w => w.code), ['going', 'stride'])

// L: landing + two flights, footprint area = flight1 + landing + flight2
const L = solve('L', { ...P, steps: 17 }, 3.0)
assert.equal(L.treads.filter(t => t.landing).length, 1)
const a = Math.floor((16 - 1) / 2)
const b = 16 - 1 - a
near(area(L.footprint), a * 0.27 + 1 + b * 0.27)
near(L.treads.at(-1)!.top + L.rise, 3.0)

// U: second flight comes back beside the first
const U = solve('U', { ...P, steps: 17 }, 3.0)
const xs = U.treads.at(-1)!.poly.map(p => p[0])
near(Math.min(...xs), 0.6)
near(U.treads.at(-1)!.top + U.rise, 3.0)

// spiral: circular footprint of radius column + width
const sp = solve('spiral', { ...P, steps: 15 }, 2.8)
near(Math.max(...sp.footprint.map(p => Math.hypot(p[0], p[1]))), 1.1)
assert.equal(sp.treads.length, 14)

// placement transform: rotate 90° CCW then translate
assert.deepEqual(toPlan({ x: 10, y: 5, rotation: 90 }, [[1, 0]]).map(p => p.map(v => +v.toFixed(9))), [[10, 6]])

// stairwell holes: stair fully inside a room → one hole ≈ footprint; half outside → clipped
const room: Vec2[] = [[0, 0], [6, 0], [6, 5], [0, 5]]
const inside = stairwellHoles(room, [[[1, 1], [2, 1], [2, 4], [1, 4]]])
assert.equal(inside.length, 1)
assert.ok(Math.abs(area(inside[0]) - 3) < 0.02)
const half = stairwellHoles(room, [[[5, 1], [7, 1], [7, 2], [5, 2]]])
assert.ok(Math.abs(area(half[0]) - 1) < 0.02, 'clipped to the room')
assert.equal(stairwellHoles(room, [[[8, 1], [9, 1], [9, 2], [8, 2]]]).length, 0, 'outside: no hole')
near(area(clipConvex(room, [[3, -1], [9, -1], [9, 9], [3, 9]])), 15)
console.log('stairs ok')
