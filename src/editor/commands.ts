// Undoable edits. Every change to floor entities goes through execute(); do/undo write to the
// in-memory project data (the reactive store) and to SQLite, then notify (autosave).
import { reactive } from 'vue'
import type { Database } from 'sql.js'
import * as repo from '../db/repo'
import type { ProjectData } from '../db/repo'
import type { Tables } from '../types'

export type EntityTable = 'rooms' | 'walls' | 'openings' | 'stairs' | 'zones' | 'items'
export type Entity<T extends EntityTable = EntityTable> = Tables[T]

export interface Command {
  label: string
  do(): void
  undo(): void
}

interface Ctx {
  db: Database
  data: ProjectData
  changed(): void
}

const LIMIT = 200
let ctx: Ctx | null = null
let undoStack: Command[] = []
let redoStack: Command[] = []
/** Reactive mirror for the UI (enable/disable undo & redo, tooltips). */
export const history = reactive({ undo: '', redo: '' })

function sync() {
  history.undo = undoStack.at(-1)?.label ?? ''
  history.redo = redoStack.at(-1)?.label ?? ''
}

/** Point commands at a project (or null on close). Clears history. */
export function bind(c: Ctx | null) {
  ctx = c
  undoStack = []
  redoStack = []
  sync()
}

const need = () => {
  if (!ctx) throw new Error('No project bound')
  return ctx
}

export function execute(cmd: Command) {
  const c = need()
  cmd.do()
  undoStack.push(cmd)
  if (undoStack.length > LIMIT) undoStack.shift()
  redoStack = []
  sync()
  c.changed()
}

export function undo() {
  const cmd = undoStack.pop()
  if (!cmd) return
  cmd.undo()
  redoStack.push(cmd)
  sync()
  need().changed()
}

export function redo() {
  const cmd = redoStack.pop()
  if (!cmd) return
  cmd.do()
  undoStack.push(cmd)
  sync()
  need().changed()
}

// ---------- primitives (store + repo) ----------

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const list = <T extends EntityTable>(t: T) => need().data[t] as Entity<T>[]

export function find<T extends EntityTable>(t: T, id: string): Entity<T> | undefined {
  return list(t).find(e => e.id === id)
}

function put<T extends EntityTable>(t: T, e: Entity<T>, index = list(t).length) {
  list(t).splice(index, 0, clone(e))
  repo.insert(need().db, t, e)
}

function drop(t: EntityTable, id: string) {
  const l = list(t)
  const index = l.findIndex(e => e.id === id)
  if (index < 0) return null
  const [entity] = l.splice(index, 1)
  repo.remove(need().db, t, id)
  return { t, entity: clone(entity), index }
}

function patchEntity<T extends EntityTable>(t: T, id: string, patch: Partial<Entity<T>>) {
  const e = find(t, id)
  if (!e) return
  Object.assign(e, clone(patch))
  repo.update(need().db, t, id, patch)
}

/** Store-only change for live previews (drags). Commit with updateEntity(…, prev) on release. */
export function preview<T extends EntityTable>(t: T, id: string, patch: Partial<Entity<T>>) {
  const e = find(t, id)
  if (e) Object.assign(e, patch)
}

// ---------- commands ----------

export function addEntity<T extends EntityTable>(t: T, entity: Entity<T>, label = `Add ${t.slice(0, -1)}`): Command {
  const e = clone(entity)
  return { label, do: () => put(t, e), undo: () => void drop(t, e.id) }
}

/** Entities that must go with `id`: openings hosted by a room or free wall. */
function dependants(id: string) {
  return list('openings').filter(o => ('roomId' in o.host ? o.host.roomId : o.host.wallId) === id)
}

export function removeEntity(t: EntityTable, id: string, label = `Delete ${t.slice(0, -1)}`): Command {
  let removed: NonNullable<ReturnType<typeof drop>>[] = []
  return {
    label,
    do() {
      const deps = t === 'rooms' || t === 'walls' ? dependants(id).map(o => o.id) : []
      removed = [...deps.map(d => drop('openings', d)), drop(t, id)].filter(r => r !== null)
    },
    undo() {
      for (const r of [...removed].reverse()) put(r.t, r.entity as never, r.index)
    }
  }
}

/** `prev` defaults to the current values of the patched fields; pass it when the store was already previewed. */
export function updateEntity<T extends EntityTable>(
  t: T,
  id: string,
  patch: Partial<Entity<T>>,
  prev?: Partial<Entity<T>>,
  label = `Edit ${t.slice(0, -1)}`
): Command {
  const cur = find(t, id) as Record<string, unknown> | undefined
  const before = clone(prev ?? (Object.fromEntries(Object.keys(patch).map(k => [k, cur?.[k]])) as Partial<Entity<T>>))
  const after = clone(patch)
  return { label, do: () => patchEntity(t, id, after), undo: () => patchEntity(t, id, before) }
}

export function batch(label: string, cmds: Command[]): Command {
  return {
    label,
    do: () => cmds.forEach(c => c.do()),
    undo: () => [...cmds].reverse().forEach(c => c.undo())
  }
}

/** Find which table an id lives in. */
export function locate(id: string): { t: EntityTable; e: Entity } | null {
  for (const t of repo.FLOOR_TABLES as readonly EntityTable[]) {
    const e = find(t, id)
    if (e) return { t, e }
  }
  return null
}
