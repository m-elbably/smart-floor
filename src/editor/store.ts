// The single reactive app store and its actions. UI reads it; actions persist via repo + scheduleSave.
// Project/floor actions write directly (not undoable); entity edits go through editor/commands.ts.
import { reactive, computed } from 'vue'
import type { Floor, Project, Vec2 } from '@/types'
import type { View, FloorVisibility } from '@/scene/viewport'
import { useDb, scheduleSave, type SaveState } from '@/db/sqlite'
import * as repo from '@/db/repo'
import type { ProjectData } from '@/db/repo'
import * as floorOps from './floors'
import type { Units } from './units'
import * as commands from './commands'
import type { SnapKind } from './snapping'

export interface Settings {
  units: Units
  theme: 'system' | 'light' | 'dark'
  grid: number
  floorHeight: number
  slab: number
  wallInterior: number
  wallExterior: number
  /** Catalog: last placed item ids (newest first, max 8) and starred ones. */
  recent: string[]
  favourites: string[]
  /** First-run tips were shown. */
  tipsSeen: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  theme: 'system',
  grid: 0.1,
  floorHeight: 2.8,
  slab: 0.2,
  wallInterior: 0.15,
  wallExterior: 0.25,
  recent: [],
  favourites: [],
  tipsSeen: false
}

export type ToolId = 'select' | 'rect' | 'polygon' | 'template' | 'wall' | 'door' | 'window' | 'stair' | 'zone' | 'site' | 'item' | 'measure'

export const store = reactive({
  projects: [] as Project[],
  data: null as ProjectData | null,
  activeFloorId: '',
  settings: { ...DEFAULT_SETTINGS } as Settings,
  saveState: 'saved' as SaveState,
  view: '2d' as View,
  floorVisibility: 'ghost' as FloorVisibility,
  cursor: null as Vec2 | null,
  dark: false,
  selection: [] as string[],
  hover: null as string | null,
  tool: 'select' as ToolId,
  toolOptions: { template: 'rect', door: 'single', window: 'standard', stair: 'straight', zone: 'grass', wall: 'wall', item: '' },
  catalogOpen: true,
  walkLocked: false,
  showDims: false,
  showLabels: true,
  snapKind: null as SnapKind | null,
  /** Short status-bar hint from the active tool. */
  hint: '',
  /** Transient message for a toast (n bumps so repeats still fire). */
  notice: { text: '', n: 0 },
  ui: {
    palette: false,
    help: false,
    summary: false,
    export: null as null | 'png' | 'glb' | 'pdf',
    confirm: null as null | { title: string; text: string; yes: string; no: string; onYes: () => void; onNo: () => void }
  }
})

export function notify(text: string) {
  store.notice = { text, n: store.notice.n + 1 }
}

export const activeFloor = computed(() => store.data?.floors.find(f => f.id === store.activeFloorId) ?? null)

const uid = () => crypto.randomUUID()

// ---------- settings ----------

export function loadSettings() {
  store.settings = { ...DEFAULT_SETTINGS, ...repo.getSetting(useDb(), 'settings', {}) }
}

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(store.settings, patch)
  repo.setSetting(useDb(), 'settings', store.settings)
  scheduleSave()
}

// ---------- projects ----------

export function refreshProjects() {
  store.projects = repo.listProjects(useDb())
}

export function createProject(name: string, description = ''): Project {
  const db = useDb()
  const now = Date.now()
  const project: Project = { id: uid(), name, description, thumbnail: null, site: null, createdAt: now, updatedAt: now }
  const floor: Floor = {
    id: uid(),
    projectId: project.id,
    name: floorOps.defaultFloorName(0),
    level: 0,
    elevation: 0,
    height: store.settings.floorHeight,
    slab: store.settings.slab
  }
  repo.tx(db, () => {
    repo.insert(db, 'projects', project)
    repo.insert(db, 'floors', floor)
  })
  scheduleSave()
  refreshProjects()
  return project
}

export function updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'description'>>) {
  repo.update(useDb(), 'projects', id, { ...patch, updatedAt: Date.now() })
  if (store.data?.project.id === id) Object.assign(store.data.project, patch)
  scheduleSave()
  refreshProjects()
}

export function duplicateProject(id: string) {
  const src = store.projects.find(p => p.id === id)
  repo.duplicateProject(useDb(), id, `${src?.name ?? 'Project'} (copy)`)
  scheduleSave()
  refreshProjects()
}

export function deleteProject(id: string) {
  if (store.data?.project.id === id) closeProject()
  repo.remove(useDb(), 'projects', id) // cascades to floors and everything on them
  scheduleSave()
  refreshProjects()
}

export function openProject(id: string) {
  const data = repo.loadProject(useDb(), id)
  if (!data) throw new Error(`Project ${id} not found`)
  store.data = data
  store.activeFloorId = (data.floors.find(f => f.level === 0) ?? data.floors[0]).id
  store.selection = []
  bindCommands()
}

/** Commands edit store.data (reactive) + SQLite; every edit bumps updatedAt and schedules a save. */
function bindCommands() {
  commands.bind(store.data ? { db: useDb(), data: store.data, changed: touch } : null)
}

// ---------- thumbnails [FR-04] ----------

let thumbnailer: (() => Uint8Array | null) | null = null
let thumbAt = 0
/** The viewport registers how to take a thumbnail of the open project. */
export function setThumbnailer(fn: (() => Uint8Array | null) | null) {
  thumbnailer = fn
}
/** Refresh the open project's thumbnail (not an edit: no undo entry, no "edited" time bump). */
export function captureThumbnail() {
  const bytes = store.data && thumbnailer?.()
  if (!bytes || !store.data) return
  store.data.project.thumbnail = bytes
  repo.update(useDb(), 'projects', store.data.project.id, { thumbnail: bytes })
  thumbAt = Date.now()
  scheduleSave()
}
/** While editing: at most once a minute, and only if something changed since the last one. */
export function maybeCaptureThumbnail() {
  if (store.data && store.data.project.updatedAt > thumbAt && Date.now() - thumbAt > 60_000) captureThumbnail()
}

export function closeProject() {
  captureThumbnail()
  store.data = null
  bindCommands()
  store.selection = []
  store.activeFloorId = ''
  refreshProjects()
}

/** Mark the open project modified (bumps updatedAt, schedules autosave). */
export function touch() {
  if (!store.data) return
  store.data.project.updatedAt = Date.now()
  repo.update(useDb(), 'projects', store.data.project.id, { updatedAt: store.data.project.updatedAt })
  scheduleSave()
}

// ---------- floors ----------

/** Persist a new floor order/elevations and put it in the store. */
function commitFloors(floors: Floor[]) {
  const db = useDb()
  repo.tx(db, () => {
    for (const f of floors) repo.update(db, 'floors', f.id, { level: f.level, elevation: f.elevation })
  })
  store.data!.floors = floors
  touch()
}

export function addFloor(where: 'above' | 'below') {
  if (!store.data) return
  const floor: Floor = {
    id: uid(),
    projectId: store.data.project.id,
    name: '',
    level: 0,
    elevation: 0,
    height: store.settings.floorHeight,
    slab: store.settings.slab
  }
  const floors = floorOps.addFloor(store.data.floors.map(f => ({ ...f })), floor, where)
  floor.name = floorOps.defaultFloorName(floor.level)
  repo.insert(useDb(), 'floors', floor)
  commitFloors(floors)
  store.activeFloorId = floor.id
}

export function updateFloor(id: string, patch: Partial<Pick<Floor, 'name' | 'height' | 'slab'>>) {
  if (!store.data) return
  repo.update(useDb(), 'floors', id, patch)
  const floors = store.data.floors.map(f => (f.id === id ? { ...f, ...patch } : { ...f }))
  commitFloors(floorOps.restack(floorOps.sortByLevel(floors), floorOps.groundIndexOf(floorOps.sortByLevel(floors))))
}

export function moveFloor(id: string, dir: 1 | -1) {
  if (!store.data) return
  commitFloors(floorOps.moveFloor(store.data.floors.map(f => ({ ...f })), id, dir))
}

/** Copy a floor's rooms, free walls, doors and windows onto a new floor on top [FR-14]. */
export function duplicateFloorAbove(id: string) {
  if (!store.data) return
  const src = store.data.floors.find(f => f.id === id)
  if (!src) return
  addFloor('above')
  const target = activeFloor.value!
  updateFloor(target.id, { height: src.height })
  const ids = new Map<string, string>()
  const nid = (old: string) => ids.get(old) ?? (ids.set(old, uid()), ids.get(old)!)
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const rooms = store.data.rooms.filter(r => r.floorId === id).map(r => ({ ...clone(r), id: nid(r.id), floorId: target.id }))
  const walls = store.data.walls.filter(w => w.floorId === id).map(w => ({ ...clone(w), id: nid(w.id), floorId: target.id }))
  const openings = store.data.openings
    .filter(o => o.floorId === id)
    .map(o => ({
      ...clone(o),
      id: nid(o.id),
      floorId: target.id,
      host: 'roomId' in o.host ? { roomId: nid(o.host.roomId), edge: o.host.edge } : { wallId: nid(o.host.wallId) }
    }))
  const db = useDb()
  repo.tx(db, () => {
    for (const r of rooms) repo.insert(db, 'rooms', r)
    for (const w of walls) repo.insert(db, 'walls', w)
    for (const o of openings) repo.insert(db, 'openings', o)
  })
  store.data.rooms.push(...rooms)
  store.data.walls.push(...walls)
  store.data.openings.push(...openings)
  touch()
}

export function removeFloor(id: string) {
  if (!store.data || store.data.floors.length < 2) return
  const floors = floorOps.removeFloor(store.data.floors.map(f => ({ ...f })), id)
  repo.remove(useDb(), 'floors', id) // cascades to everything on the floor
  for (const t of repo.FLOOR_TABLES) (store.data[t] as { floorId: string }[]) = store.data[t].filter(e => e.floorId !== id)
  if (store.activeFloorId === id) store.activeFloorId = (floors.find(f => f.level === 0) ?? floors[0]).id
  commitFloors(floors)
  bindCommands() // history may reference the deleted floor's entities
}
