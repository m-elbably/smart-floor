// Owns the single sql.js Database and its file on disk: load, migrate, debounced atomic save, daily backups.
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { isNeutralino, dataDir, exists, readBin, writeBin, move, copy, stats, remove } from '@/neu'
import { migrate, exportDb } from './repo'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const FILE = 'smart-floor.sqlite'
const BACKUPS = 3
const SAVE_DELAY = 1000

let SQL: SqlJsStatic
let db: Database | null = null
let path = ''
let timer: ReturnType<typeof setTimeout> | undefined
let queue: Promise<void> = Promise.resolve()
let listener: (s: SaveState) => void = () => {}

export class DbOpenError extends Error {
  constructor(
    public cause: unknown,
    public backups: string[]
  ) {
    super('The database file could not be opened')
  }
}

/** A fresh, separate database (project files): empty, or opened from bytes. Not the app database. */
export async function newDatabase(bytes?: Uint8Array): Promise<Database> {
  SQL ??= await initSqlJs({ locateFile: () => './sql-wasm.wasm' })
  return bytes ? new SQL.Database(bytes) : new SQL.Database()
}

export function useDb(): Database {
  if (!db) throw new Error('Database not open')
  return db
}

export function onSaveState(fn: (s: SaveState) => void) {
  listener = fn
}

const bak = (n: number) => `${path}.bak${n}`

async function load(bytes: Uint8Array | null): Promise<Database> {
  const d = bytes ? new SQL.Database(bytes) : new SQL.Database()
  const check = d.exec('PRAGMA integrity_check')[0]?.values[0][0] // throws on a non-SQLite file
  if (check !== 'ok') throw new Error(`integrity_check: ${check}`)
  migrate(d)
  return d
}

/** Open (or create) the app database. Throws DbOpenError listing restorable backups when the file is corrupt. */
export async function openDb(): Promise<Database> {
  SQL ??= await initSqlJs({ locateFile: () => './sql-wasm.wasm' })
  if (!isNeutralino) {
    // ponytail: plain-browser dev is in-memory only; the real app always runs inside Neutralino.
    console.warn('Not running in Neutralino: database is in-memory and will not be saved')
    return (db = await load(null))
  }
  path = `${await dataDir()}/${FILE}`
  if (!(await exists(path))) return (db = await load(null))
  try {
    return (db = await load(new Uint8Array(await readBin(path))))
  } catch (e) {
    const backups: string[] = []
    for (let n = 1; n <= BACKUPS; n++) if (await exists(bak(n))) backups.push(bak(n))
    throw new DbOpenError(e, backups)
  }
}

/** Replace the corrupt file with a backup (or nothing) and reopen. The corrupt file is kept aside, never deleted. */
export async function recover(backup: string | null): Promise<Database> {
  await move(path, `${path}.corrupt-${Date.now()}`)
  if (backup) await copy(backup, path)
  return openDb()
}

export function scheduleSave() {
  listener('dirty')
  clearTimeout(timer)
  timer = setTimeout(save, SAVE_DELAY)
}

/** Save now (also flushes a pending debounced save). Saves are serialised so writes never interleave. */
export function save(): Promise<void> {
  clearTimeout(timer)
  timer = undefined
  queue = queue.then(write).catch(e => {
    console.error('Save failed', e)
    listener('error')
  })
  return queue
}

async function write() {
  if (!db || !isNeutralino) return listener('saved')
  listener('saving')
  if (await exists(path)) await rotateBackups()
  await writeBin(`${path}.tmp`, exportDb(db))
  await move(`${path}.tmp`, path) // atomic replace: a crash leaves either the old or the new file
  listener('saved')
}

/** Once per calendar day, shift .bak1 -> .bak2 -> .bak3 and copy the current file to .bak1. */
async function rotateBackups() {
  if (await exists(bak(1))) {
    const last = new Date((await stats(bak(1))).modifiedAt).toDateString()
    if (last === new Date().toDateString()) return
  }
  if (await exists(bak(BACKUPS))) await remove(bak(BACKUPS))
  for (let n = BACKUPS - 1; n >= 1; n--) if (await exists(bak(n))) await move(bak(n), bak(n + 1))
  await copy(path, bak(1))
}
