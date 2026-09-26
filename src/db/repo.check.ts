import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import * as repo from './repo'
import type { Floor, Project, Room } from '../types'

const SQL = await initSqlJs()
const db = new SQL.Database()
repo.migrate(db)
repo.migrate(db) // idempotent
assert.equal(db.exec('PRAGMA user_version')[0].values[0][0], 1)

const now = Date.now()
const project: Project = { id: 'p1', name: 'House', description: '', thumbnail: null, site: null, createdAt: now, updatedAt: now }
const floor: Floor = { id: 'f1', projectId: 'p1', name: 'Ground Floor', level: 0, elevation: 0, height: 2.8, slab: 0.2 }
const room: Room = {
  id: 'r1', floorId: 'f1', name: 'Living', kind: 'generic',
  polygon: [[0, 0], [4, 0], [4, 3], [0, 3]], floorMaterial: 'wood', wallColor: '#fff', ceiling: true
}
repo.insert(db, 'projects', project)
repo.insert(db, 'floors', floor)
repo.insert(db, 'rooms', room)

// JSON + boolean round trip
assert.deepEqual(repo.get(db, 'rooms', 'r1'), room)
repo.update(db, 'rooms', 'r1', { name: 'Lounge', ceiling: false, polygon: [[0, 0], [5, 0], [5, 3]] })
const r = repo.get(db, 'rooms', 'r1')!
assert.equal(r.name, 'Lounge')
assert.equal(r.ceiling, false)
assert.deepEqual(r.polygon, [[0, 0], [5, 0], [5, 3]])

const data = repo.loadProject(db, 'p1')!
assert.equal(data.floors.length, 1)
assert.equal(data.rooms.length, 1)
assert.equal(repo.listProjects(db)[0].name, 'House')

repo.setSetting(db, 'units', 'metric')
repo.setSetting(db, 'units', 'imperial')
assert.equal(repo.getSetting(db, 'units', 'metric'), 'imperial')
assert.equal(repo.getSetting(db, 'missing', 42), 42)

assert.throws(() => repo.update(db, 'rooms', 'r1', { ['name; DROP TABLE rooms' as 'name']: 'x' }))

// export() reopens the connection in sql.js, which drops PRAGMA foreign_keys; repo.exportDb must restore it
const bytes = repo.exportDb(db)
assert.ok(bytes.length > 0)
repo.remove(db, 'projects', 'p1') // cascades
assert.equal(repo.listBy(db, 'floors', 'projectId', 'p1').length, 0)
assert.equal(repo.get(db, 'rooms', 'r1'), null)

// the exported bytes still contain the project
const copy = new SQL.Database(bytes)
repo.migrate(copy)
assert.equal(repo.listProjects(copy).length, 1)
