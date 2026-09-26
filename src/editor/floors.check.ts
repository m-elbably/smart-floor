import assert from 'node:assert/strict'
import { addFloor, moveFloor, removeFloor, defaultFloorName } from './floors'

const mk = (id: string, height = 2.8, slab = 0.2) => ({ id, level: 0, elevation: 0, height, slab })
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

let fl = [mk('g')]
fl = addFloor(fl, mk('f1'), 'above')
fl = addFloor(fl, mk('f2', 3), 'above')
fl = addFloor(fl, mk('b1', 2.5, 0.3), 'below')
assert.deepEqual(fl.map(f => [f.id, f.level]), [['b1', -1], ['g', 0], ['f1', 1], ['f2', 2]])
near(fl[1].elevation, 0)
near(fl[2].elevation, 3.0) // 0 + 2.8 + 0.2
near(fl[3].elevation, 6.0) // 3.0 + 2.8 + 0.2
near(fl[0].elevation, -2.7) // 0 - 0.2 (ground slab) - 2.5

// move f2 down one: ground stays index 1 so f2 becomes level 1
fl = moveFloor(fl, 'f2', -1)
assert.deepEqual(fl.map(f => [f.id, f.level]), [['b1', -1], ['g', 0], ['f2', 1], ['f1', 2]])
near(fl[3].elevation, 3.0 + 3 + 0.2)
// moving past the ends is a no-op
assert.deepEqual(moveFloor(fl, 'f1', 1).map(f => f.id), ['b1', 'g', 'f2', 'f1'])

// removing the basement keeps ground at level 0
fl = removeFloor(fl, 'b1')
assert.deepEqual(fl.map(f => [f.id, f.level]), [['g', 0], ['f2', 1], ['f1', 2]])
// removing ground: next floor up becomes ground
fl = removeFloor(fl, 'g')
assert.deepEqual(fl.map(f => [f.id, f.level]), [['f2', 0], ['f1', 1]])
near(fl[0].elevation, 0)
// the last floor cannot be removed
assert.equal(removeFloor([mk('only')], 'only').length, 1)

assert.equal(defaultFloorName(0), 'Ground Floor')
assert.equal(defaultFloorName(1), '1st Floor')
assert.equal(defaultFloorName(12), '12th Floor')
assert.equal(defaultFloorName(-2), 'Basement 2')
