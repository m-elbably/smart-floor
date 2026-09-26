import assert from 'node:assert/strict'
import type { Vec2 } from '../types'
import * as g from './geometry'

const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ''} ${a} ≠ ${b}`)
const rect = (x: number, y: number, w: number, h: number): Vec2[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

// area / centroid / orientation
near(g.area(rect(0, 0, 4, 3)), 12)
assert.deepEqual(g.centroid(rect(0, 0, 4, 2)), [2, 1])
const L: Vec2[] = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]]
near(g.area(L), 12)
assert.ok(g.signedArea(g.ensureCCW([...rect(0, 0, 1, 1)].reverse())) > 0)

// simplicity
assert.ok(g.isSimple(L))
assert.ok(!g.isSimple([[0, 0], [2, 2], [2, 0], [0, 2]]), 'bow tie')
assert.ok(!g.isSimple([[0, 0], [1, 0], [2, 0]]), 'degenerate')

// point in polygon, projection
assert.ok(g.pointInPolygon([1, 1], L))
assert.ok(!g.pointInPolygon([3, 3], L))
const pr = g.projectOnSegment([2, 5], [0, 0], [4, 0])
near(pr.t, 0.5)
near(g.segDistance([2, 5], [0, 0], [4, 0]), 5)
near(g.segDistance([-3, 4], [0, 0], [4, 0]), 5)

// deriveWalls: single room → 4 exterior walls pushed out by half thickness, extended at corners
{
  const w = g.deriveWalls([{ id: 'a', polygon: rect(0, 0, 4, 3) }], 0.1, 0.2)
  assert.equal(w.length, 4)
  assert.ok(w.every(x => x.exterior && x.thickness === 0.2))
  const bottom = w.find(x => x.hosts[0].edge === 0)!
  assert.deepEqual(bottom.a.map(v => +v.toFixed(6)), [-0.2, -0.1])
  assert.deepEqual(bottom.b.map(v => +v.toFixed(6)), [4.2, -0.1])
}

// two adjacent rooms sharing a full edge → 7 walls, one interior with both hosts, centred on the line
{
  const w = g.deriveWalls([{ id: 'a', polygon: rect(0, 0, 4, 3) }, { id: 'b', polygon: rect(4, 0, 3, 3) }], 0.1, 0.2)
  assert.equal(w.length, 7)
  const shared = w.filter(x => !x.exterior)
  assert.equal(shared.length, 1)
  assert.deepEqual(shared[0].hosts.map(h => h.roomId).sort(), ['a', 'b'])
  near(shared[0].a[0], 4)
  near(shared[0].b[0], 4)
  near(g.dist(shared[0].a, shared[0].b), 3)
  // collinear neighbours along the bottom: A's piece is not extended into B's (and vice versa)
  const bottom = w.filter(x => x.exterior && Math.abs(x.a[1] + 0.1) < 1e-9).map(x => g.dist(x.a, x.b)).sort()
  assert.deepEqual(bottom.map(v => +v.toFixed(6)), [3.2, 4.2])
}

// partial overlap → shared piece plus exterior pieces on each side
{
  const w = g.deriveWalls([{ id: 'a', polygon: rect(0, 0, 4, 3) }, { id: 'b', polygon: rect(2, 3, 4, 2) }], 0.1, 0.2)
  const onLine = w.filter(x => Math.abs(x.a[1] - x.b[1]) < 1e-9 && Math.abs(Math.abs(x.a[1] - 3) - 0) < 0.11)
  const shared = onLine.filter(x => !x.exterior)
  assert.equal(shared.length, 1)
  near(Math.min(shared[0].a[0], shared[0].b[0]), 2)
  near(Math.max(shared[0].a[0], shared[0].b[0]), 4)
  const aOnly = onLine.find(x => x.exterior && x.hosts[0].roomId === 'a')!
  near(aOnly.a[1], 3.1, 'a-only piece pushed outward (up)')
  const bOnly = onLine.find(x => x.exterior && x.hosts[0].roomId === 'b')!
  near(bOnly.a[1], 2.9, 'b-only piece pushed outward (down)')
}

// L-shape: 6 exterior walls; the reflex corner is not extended (no poke into the room)
{
  const w = g.deriveWalls([{ id: 'l', polygon: L }], 0.1, 0.2)
  assert.equal(w.length, 6)
  const e2 = w.find(x => x.hosts[0].edge === 2)! // (4,2) → (2,2), ends at reflex (2,2)
  near(Math.min(e2.a[0], e2.b[0]), 2, 'not extended at reflex corner')
  near(Math.max(e2.a[0], e2.b[0]), 4.2, 'extended at convex corner')
}

// wallSegments
assert.deepEqual(g.wallSegments(5, [{ id: 'd', center: 2, width: 1 }]), [{ from: 0, to: 1.5 }, { from: 1.5, to: 2.5, openingId: 'd' }, { from: 2.5, to: 5 }])
assert.deepEqual(g.wallSegments(3, [{ id: 'd', center: 0.4, width: 0.8 }]), [{ from: 0, to: 0.8, openingId: 'd' }, { from: 0.8, to: 3 }], 'at start')
assert.deepEqual(g.wallSegments(3, [{ id: 'd', center: 2.6, width: 0.8 }]), [{ from: 0, to: 2.2 }, { from: 2.2, to: 3, openingId: 'd' }], 'clamped at end')
assert.deepEqual(
  g.wallSegments(4, [{ id: 'y', center: 2.5, width: 1 }, { id: 'x', center: 1.5, width: 1 }]),
  [{ from: 0, to: 1 }, { from: 1, to: 2, openingId: 'x' }, { from: 2, to: 3, openingId: 'y' }, { from: 3, to: 4 }],
  'adjacent'
)
console.log('geometry ok')
assert.ok(g.isConvex(rect(0, 0, 2, 1)) && !g.isConvex(L), 'isConvex')
