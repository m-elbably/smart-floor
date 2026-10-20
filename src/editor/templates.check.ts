import assert from 'node:assert/strict'
import type { Item, Room } from '../types'
import {
  getTemplate,
  allTemplates,
  extractRoomAsTemplate,
  templateStats,
  saveRoomAsTemplate,
  deleteTemplate
} from './templates'
import { store } from './store'
import { bbox } from './geometry'

// 1. Built-in template retrieval
const rectT = getTemplate('rect')
assert.equal(rectT.id, 'rect')
assert.equal(rectT.kind, 'generic')
assert.equal(getTemplate('unknown_id').id, 'rect')
assert.equal(getTemplate('bedroom').id, 'bedroom')
assert.ok(getTemplate('bedroom').items && getTemplate('bedroom').items!.length > 0)

// 2. Room extraction with furniture
const room: Room = {
  id: 'r1',
  floorId: 'f1',
  name: 'Master Bed',
  kind: 'bedroom',
  polygon: [
    [2, 1],
    [6, 1],
    [6, 5],
    [2, 5]
  ],
  floorMaterial: 'wood',
  wallColor: '#f0ede6',
  ceiling: true
}

const insideItem: Item = {
  id: 'i1',
  floorId: 'f1',
  catalogId: 'bed-double',
  x: 4,
  y: 3,
  z: 0,
  rotation: 90,
  scale: [1, 1, 1],
  variant: 'oak',
  name: null
}

const outsideItem: Item = {
  id: 'i2',
  floorId: 'f1',
  catalogId: 'plant',
  x: 10,
  y: 10,
  z: 0,
  rotation: 0,
  scale: [1, 1, 1],
  variant: null,
  name: null
}

const otherFloorItem: Item = {
  id: 'i3',
  floorId: 'f2',
  catalogId: 'sofa-3',
  x: 4,
  y: 3,
  z: 0,
  rotation: 0,
  scale: [1, 1, 1],
  variant: null,
  name: null
}

const items = [insideItem, outsideItem, otherFloorItem]

// Extract template
const extracted = extractRoomAsTemplate(room, items)
assert.equal(extracted.name, 'Master Bed')
assert.equal(extracted.kind, 'bedroom')
assert.equal(extracted.floorMaterial, 'wood')
assert.equal(extracted.wallColor, '#f0ede6')
assert.equal(extracted.custom, true)

// Polygon should be centered around [0, 0]
// Original box: min [2, 1], max [6, 5] => center [4, 3]
const b = bbox(extracted.polygon)
assert.deepEqual(b.min, [-2, -2])
assert.deepEqual(b.max, [2, 2])

// Only insideItem should be included
assert.equal(extracted.items?.length, 1)
assert.equal(extracted.items![0].catalogId, 'bed-double')
// Position relative to center [4, 3]: [4 - 4, 3 - 3] = [0, 0]
assert.deepEqual(extracted.items![0].at, [0, 0])
assert.equal(extracted.items![0].rotation, 90)
assert.equal(extracted.items![0].variant, 'oak')

// Option includeItems: false
const extractedNoItems = extractRoomAsTemplate(room, items, { includeItems: false })
assert.equal(extractedNoItems.items?.length, 0)

// 3. Stats
const stats = templateStats(extracted.polygon)
assert.equal(stats.width, 4)
assert.equal(stats.depth, 4)
assert.equal(stats.area, 16)

// 4. Save and delete custom template
const saved = saveRoomAsTemplate(room, items, { name: 'Saved Suite' })
assert.ok(saved.id)
assert.equal(store.toolOptions.template, saved.id)
assert.equal(getTemplate(saved.id).name, 'Saved Suite')
assert.ok(allTemplates().some(t => t.id === saved.id))

deleteTemplate(saved.id!)
assert.equal(store.toolOptions.template, 'rect')
assert.ok(!store.customTemplates.some(t => t.id === saved.id))

console.log('templates ok')
