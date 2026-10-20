import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import * as repo from '../db/repo'
import { bind } from './commands'
import { store } from './store'
import { rotatePoint, rotateSelectionCmd, getSelectionOrigin, previewRotate } from './rotate'
import type { Room, Item, Wall, Stair, Zone } from '../types'

// 1. Point rotation tests
// Rotate [1, 0] by 90 deg around [0, 0] -> [0, 1]
const p1 = rotatePoint([1, 0], [0, 0], 90)
assert.equal(p1[0], 0)
assert.equal(p1[1], 1)

// Rotate [1, 0] by 180 deg around [0, 0] -> [-1, 0]
const p2 = rotatePoint([1, 0], [0, 0], 180)
assert.equal(p2[0], -1)
assert.equal(p2[1], 0)

// Rotate [2, 2] by 90 deg around [2, 1] -> [1, 2] (dx=0, dy=1 -> [-1, 0] + [2, 1] = [1, 1])
const p3 = rotatePoint([2, 2], [2, 1], 90)
assert.equal(p3[0], 1)
assert.equal(p3[1], 1)

// 2. Setup mock DB & project
const SQL = await initSqlJs()
const db = new SQL.Database()
repo.migrate(db)
const now = Date.now()
repo.insert(db, 'projects', { id: 'p', name: 'P', description: '', thumbnail: null, site: null, createdAt: now, updatedAt: now })
repo.insert(db, 'floors', { id: 'f', projectId: 'p', name: 'G', level: 0, elevation: 0, height: 2.8, slab: 0.2 })
const data = repo.loadProject(db, 'p')!
bind({ db, data, changed: () => {} })
store.data = data
store.activeFloorId = 'f'

// Test room rotation
const room: Room = {
  id: 'r1',
  floorId: 'f',
  name: 'Room',
  kind: 'generic',
  polygon: [
    [-2, -1],
    [2, -1],
    [2, 1],
    [-2, 1]
  ],
  floorMaterial: 'wood',
  wallColor: '#fff',
  ceiling: true
}
data.rooms.push(room)

store.selection = ['r1']
const origin = getSelectionOrigin()
assert.deepEqual(origin, [0, 0])

const cmd = rotateSelectionCmd(90)
assert.ok(cmd)
cmd.do()

// After 90 deg rotation, [-2, -1] -> [1, -2], [2, -1] -> [1, 2], [2, 1] -> [-1, 2], [-2, 1] -> [-1, -2]
assert.deepEqual(data.rooms[0].polygon, [
  [1, -2],
  [1, 2],
  [-1, 2],
  [-1, -2]
])

cmd.undo()
assert.deepEqual(data.rooms[0].polygon, [
  [-2, -1],
  [2, -1],
  [2, 1],
  [-2, 1]
])

// Test item rotation
const item: Item = {
  id: 'i1',
  floorId: 'f',
  catalogId: 'chair',
  x: 5,
  y: 5,
  z: 0,
  rotation: 0,
  scale: [1, 1, 1],
  variant: null,
  name: null
}
data.items.push(item)

store.selection = ['i1']
const itemOrigin = getSelectionOrigin()
assert.deepEqual(itemOrigin, [5, 5])

const itemCmd = rotateSelectionCmd(45)
assert.ok(itemCmd)
itemCmd.do()
assert.equal(data.items[0].rotation, 45)
assert.equal(data.items[0].x, 5)
assert.equal(data.items[0].y, 5)

itemCmd.undo()
assert.equal(data.items[0].rotation, 0)

// Test wall rotation
const wall: Wall = {
  id: 'w1',
  floorId: 'f',
  kind: 'wall',
  a: [0, 0],
  b: [2, 0],
  thickness: 0.15,
  height: 2.5
}
data.walls.push(wall)
store.selection = ['w1']
const wallOrigin = getSelectionOrigin()
assert.deepEqual(wallOrigin, [1, 0])
const wallCmd = rotateSelectionCmd(90)
assert.ok(wallCmd)
wallCmd.do()
assert.deepEqual(data.walls[0].a, [1, -1])
assert.deepEqual(data.walls[0].b, [1, 1])
wallCmd.undo()
assert.deepEqual(data.walls[0].a, [0, 0])
assert.deepEqual(data.walls[0].b, [2, 0])

// Test stair rotation
const stair: Stair = {
  id: 's1',
  floorId: 'f',
  kind: 'straight',
  x: 10,
  y: 10,
  rotation: 0,
  params: { width: 0.9, going: 0.25, steps: 14, railLeft: true, railRight: true }
}
data.stairs.push(stair)
store.selection = ['s1']
const stairOrigin = getSelectionOrigin()
assert.deepEqual(stairOrigin, [10, 10])
const stairCmd = rotateSelectionCmd(30)
assert.ok(stairCmd)
stairCmd.do()
assert.equal(data.stairs[0].rotation, 30)
stairCmd.undo()
assert.equal(data.stairs[0].rotation, 0)

// Test zone rotation
const zone: Zone = {
  id: 'z1',
  floorId: 'f',
  kind: 'grass',
  polygon: [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2]
  ],
  props: {}
}
data.zones.push(zone)
store.selection = ['z1']
const zoneOrigin = getSelectionOrigin()
assert.deepEqual(zoneOrigin, [1, 1])
const zoneCmd = rotateSelectionCmd(90)
assert.ok(zoneCmd)
zoneCmd.do()
zoneCmd.undo()
assert.deepEqual(data.zones[0].polygon, [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2]
])

// Test previewRotate with snapshot does not compound
const chair: Item = {
  id: 'i2',
  floorId: 'f',
  catalogId: 'chair',
  x: 0,
  y: 0,
  z: 0,
  rotation: 45,
  scale: [1, 1, 1],
  variant: null,
  name: null
}
data.items.push(chair)
store.selection = ['i2']
const snap = new Map<string, Record<string, unknown>>()
snap.set('i2', { x: 0, y: 0, rotation: 45 })

// Multiple previewRotate calls with same deg must give same result (not compound!)
previewRotate(15, [0, 0], snap)
assert.equal(data.items.find(i => i.id === 'i2')!.rotation, 60)
previewRotate(15, [0, 0], snap)
assert.equal(data.items.find(i => i.id === 'i2')!.rotation, 60)
previewRotate(30, [0, 0], snap)
assert.equal(data.items.find(i => i.id === 'i2')!.rotation, 75)
previewRotate(0, [0, 0], snap)
assert.equal(data.items.find(i => i.id === 'i2')!.rotation, 45)

console.log('rotate ok')
