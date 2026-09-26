import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import * as repo from '../db/repo'
import * as cmd from './commands'
import type { Opening, Room } from '../types'

const SQL = await initSqlJs()
const db = new SQL.Database()
repo.migrate(db)
const now = Date.now()
repo.insert(db, 'projects', { id: 'p', name: 'P', description: '', thumbnail: null, site: null, createdAt: now, updatedAt: now })
repo.insert(db, 'floors', { id: 'f', projectId: 'p', name: 'G', level: 0, elevation: 0, height: 2.8, slab: 0.2 })
const data = repo.loadProject(db, 'p')!
let changes = 0
cmd.bind({ db, data, changed: () => changes++ })

const snapshot = () => JSON.stringify({ mem: [data.rooms, data.openings], db: repo.loadProject(db, 'p') })
const start = snapshot()

const room: Room = { id: 'r', floorId: 'f', name: 'A', kind: 'generic', polygon: [[0, 0], [4, 0], [4, 3], [0, 3]], floorMaterial: 'wood', wallColor: '#fff', ceiling: true }
const door: Opening = { id: 'o', floorId: 'f', host: { roomId: 'r', edge: 0 }, along: 2, kind: 'door', preset: 'single', width: 0.9, height: 2.1, sill: 0, props: {} }

cmd.execute(cmd.addEntity('rooms', room))
cmd.execute(cmd.addEntity('openings', door))
const withDoor = snapshot()
cmd.execute(cmd.updateEntity('rooms', 'r', { name: 'B', polygon: [[0, 0], [5, 0], [5, 3], [0, 3]] }))
assert.equal(data.rooms[0].name, 'B')
assert.equal(repo.get(db, 'rooms', 'r')!.name, 'B')

// drag-style: preview in store, then commit with explicit prev
cmd.preview('rooms', 'r', { name: 'dragging' })
cmd.execute(cmd.updateEntity('rooms', 'r', { name: 'C' }, { name: 'B' }))
cmd.execute(cmd.removeEntity('rooms', 'r'))
assert.equal(data.rooms.length, 0)
assert.equal(data.openings.length, 0, 'hosted door removed with its room')
assert.equal(repo.listBy(db, 'openings', 'floorId', 'f').length, 0)

cmd.undo() // remove
assert.equal(data.openings.length, 1, 'door restored')
assert.equal(data.rooms[0].name, 'C')
cmd.undo() // C
assert.equal(repo.get(db, 'rooms', 'r')!.name, 'B')
cmd.undo() // B
assert.equal(snapshot(), withDoor)
cmd.undo()
cmd.undo()
assert.equal(snapshot(), start, 'undo ×5 restores the original state in memory and in SQLite')

cmd.redo()
cmd.redo()
assert.equal(snapshot(), withDoor)
assert.equal(cmd.history.undo, 'Add opening')
cmd.execute(cmd.batch('Two', [cmd.updateEntity('rooms', 'r', { name: 'X' }), cmd.updateEntity('openings', 'o', { along: 1 })]))
cmd.undo()
assert.equal(snapshot(), withDoor, 'batch undo')
assert.equal(cmd.history.redo, 'Two')
assert.ok(changes > 0)
console.log('commands ok')
