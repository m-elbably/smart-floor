import assert from 'node:assert/strict'
import { pageTransform, PAPER, MARGIN } from './layout'

const [w, h] = PAPER.a4
// 1:100 → 10 mm of paper per metre: a 4 m wall is 40 mm long on the printout
const t = pageTransform([0, 0], [8, 6], h, w, 100) // landscape A4
assert.equal(t.k, 10)
const [x0, y0] = t.map([0, 0])
const [x1] = t.map([4, 0])
assert.equal(x1 - x0, 40)
assert.ok(t.map([0, 6])[1] < y0, 'north is up')
assert.equal(t.denominator, 100)
// 1:50 of a 20 m building doesn't fit A4 portrait → falls back to fit and reports the real scale
const big = pageTransform([0, 0], [20, 10], w, h, 50)
assert.equal(big.fixedFits, false)
assert.ok(big.k < 20 && big.denominator > 50)
// fit fills the width (or height) exactly
const fit = pageTransform([0, 0], [20, 10], w, h, 'fit')
assert.ok(Math.abs(20 * fit.k - (w - 2 * MARGIN)) < 1e-9)
console.log('layout ok')
