// Generic CRUD over sql.js. Rows map 1:1 to src/types.ts; JSON and boolean columns are converted here.
import type { Database, SqlValue } from 'sql.js'
import type { Tables, TableName, Project, Floor } from '@/types'
import { migrations } from './migrations'

const JSON_COLS: Record<TableName, string[]> = {
  projects: ['site'],
  floors: [],
  rooms: ['polygon'],
  walls: ['a', 'b'],
  openings: ['host', 'props'],
  stairs: ['params'],
  zones: ['polygon', 'props'],
  items: ['scale']
}
const BOOL_COLS: Partial<Record<TableName, string[]>> = { rooms: ['ceiling'] }

/** Tables that hang off a floor, in the order loadProject returns them. */
export const FLOOR_TABLES = ['rooms', 'walls', 'openings', 'stairs', 'zones', 'items'] as const

const IDENT = /^[A-Za-z]+$/
function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Bad identifier: ${name}`)
  return name
}

function encode(table: TableName, row: Record<string, unknown>): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue
    if (JSON_COLS[table].includes(k)) out[k] = v === null ? null : JSON.stringify(v)
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0
    else out[k] = v as SqlValue
  }
  return out
}

function decode<T extends TableName>(table: T, row: Record<string, SqlValue>): Tables[T] {
  const out: Record<string, unknown> = { ...row }
  for (const k of JSON_COLS[table]) if (typeof out[k] === 'string') out[k] = JSON.parse(out[k] as string)
  for (const k of BOOL_COLS[table] ?? []) out[k] = out[k] === 1
  return out as unknown as Tables[T]
}

function all(db: Database, sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows: Record<string, SqlValue>[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

export function migrate(db: Database) {
  db.exec('PRAGMA foreign_keys = ON')
  const version = db.exec('PRAGMA user_version')[0].values[0][0] as number
  for (let v = version; v < migrations.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(migrations[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
}

/** Serialise the DB. sql.js reopens the connection on export, which resets connection pragmas, so re-apply them. */
export function exportDb(db: Database): Uint8Array {
  const bytes = db.export()
  db.exec('PRAGMA foreign_keys = ON')
  return bytes
}

export function insert<T extends TableName>(db: Database, table: T, row: Tables[T]) {
  const r = encode(table, row as unknown as Record<string, unknown>)
  const cols = Object.keys(r).map(ident)
  db.run(`INSERT INTO ${ident(table)} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(r))
}

export function update<T extends TableName>(db: Database, table: T, id: string, patch: Partial<Tables[T]>) {
  const r = encode(table, patch as Record<string, unknown>)
  delete r.id
  const cols = Object.keys(r).map(ident)
  if (!cols.length) return
  db.run(`UPDATE ${ident(table)} SET ${cols.map(c => `${c} = ?`).join(',')} WHERE id = ?`, [...Object.values(r), id])
}

export function remove(db: Database, table: TableName, id: string) {
  db.run(`DELETE FROM ${ident(table)} WHERE id = ?`, [id])
}

export function get<T extends TableName>(db: Database, table: T, id: string): Tables[T] | null {
  const row = all(db, `SELECT * FROM ${ident(table)} WHERE id = ?`, [id])[0]
  return row ? decode(table, row) : null
}

export function listBy<T extends TableName>(db: Database, table: T, col: string, val: SqlValue): Tables[T][] {
  return all(db, `SELECT * FROM ${ident(table)} WHERE ${ident(col)} = ?`, [val]).map(r => decode(table, r))
}

export function listProjects(db: Database): Project[] {
  return all(db, 'SELECT * FROM projects ORDER BY updatedAt DESC').map(r => decode('projects', r))
}

export interface ProjectData {
  project: Project
  floors: Floor[]
  rooms: Tables['rooms'][]
  walls: Tables['walls'][]
  openings: Tables['openings'][]
  stairs: Tables['stairs'][]
  zones: Tables['zones'][]
  items: Tables['items'][]
}

/** Everything belonging to a project, one query per table. */
export function loadProject(db: Database, id: string): ProjectData | null {
  const project = get(db, 'projects', id)
  if (!project) return null
  const floors = all(db, 'SELECT * FROM floors WHERE projectId = ? ORDER BY level', [id]).map(r => decode('floors', r))
  const data = { project, floors } as ProjectData
  for (const t of FLOOR_TABLES) {
    const rows = all(db, `SELECT t.* FROM ${t} t JOIN floors f ON f.id = t.floorId WHERE f.projectId = ?`, [id])
    ;(data as any)[t] = rows.map(r => decode(t, r))
  }
  return data
}

export function getSetting<T>(db: Database, key: string, fallback: T): T {
  const row = all(db, 'SELECT value FROM settings WHERE key = ?', [key])[0]
  return row ? (JSON.parse(row.value as string) as T) : fallback
}

export function setSetting(db: Database, key: string, value: unknown) {
  db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value)
  ])
}

/** Run `fn` in a transaction; rolls back on error. */
export function tx<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/**
 * Deep-copy project data with fresh ids. Every string equal to an old id (foreign keys, opening hosts, …)
 * is rewritten, so new references never need listing here. Used by duplicate, and later by import/copy-floor.
 */
export function remapIds(data: Omit<ProjectData, 'project'>, newId: () => string = () => crypto.randomUUID()) {
  const map = new Map<string, string>()
  for (const t of ['floors', ...FLOOR_TABLES] as const) for (const row of data[t]) map.set(row.id, newId())
  return {
    map,
    data: JSON.parse(JSON.stringify(data), (_k, v) => (typeof v === 'string' && map.has(v) ? map.get(v) : v)) as Omit<
      ProjectData,
      'project'
    >
  }
}

export function insertProjectData(db: Database, data: ProjectData) {
  insert(db, 'projects', data.project)
  for (const f of data.floors) insert(db, 'floors', f)
  for (const t of FLOOR_TABLES) for (const row of data[t]) insert(db, t, row as never)
}

export function duplicateProject(db: Database, id: string, name: string): Project {
  const src = loadProject(db, id)
  if (!src) throw new Error(`No project ${id}`)
  const { project, ...rest } = src
  const now = Date.now()
  const copy: Project = { ...project, id: crypto.randomUUID(), name, createdAt: now, updatedAt: now }
  const { data } = remapIds(rest)
  for (const f of data.floors) f.projectId = copy.id
  tx(db, () => insertProjectData(db, { project: copy, ...data }))
  return copy
}
