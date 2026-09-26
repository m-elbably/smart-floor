import assert from 'node:assert/strict'
import { snap, type SnapCtx } from './snapping'

const c: SnapCtx = { vertices: [[0, 0], [4, 0], [4, 3]], segments: [[[0, 0], [4, 0]], [[4, 0], [4, 3]]], ppm: 100, grid: 0.1 }
const close = (a: number[], b: number[]) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9, `${a} vs ${b}`)

assert.equal(snap([4.05, 0.05], c).kind, 'vertex') // 7 px away
assert.equal(snap([2.05, 0.02], c).kind, 'midpoint')
const e = snap([3.0, 0.05], c)
assert.equal(e.kind, 'edge')
close(e.point, [3, 0])
const al = snap([4.04, 1.73], c) // x aligns with vertex column 4 (4 px), not near an edge (x distance 4 px… edge wins first)
assert.equal(al.kind, 'edge')
const a2 = snap([0.03, 2.03], c) // near x=0 of vertex [0,0], far from edges
assert.equal(a2.kind, 'align')
close(a2.point, [0, 2])
assert.equal(a2.guides.length, 1)
const ang = snap([2.03, 2.07], { ...c, prev: [1, 1] }) // ~46° → 45°
assert.equal(ang.kind, 'angle')
assert.ok(Math.abs(ang.point[0] - 1 - (ang.point[1] - 1)) < 1e-9)
const g = snap([1.234, 1.567], { ...c, vertices: [], segments: [] })
assert.equal(g.kind, 'grid')
close(g.point, [1.2, 1.6])
// zoomed out: the same metric offset is now outside the pixel radius
assert.equal(snap([4.05, 0.05], { ...c, ppm: 10 }).kind, 'vertex') // 0.7 px
assert.notEqual(snap([4.5, 0.5], { ...c, ppm: 100 }).kind, 'vertex') // 70 px
console.log('snapping ok')
