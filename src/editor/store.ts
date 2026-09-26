// The single reactive app store and its actions. UI reads it; actions persist via repo + scheduleSave.
// ponytail: project/floor actions write directly; M4 routes entity edits through the undoable command stack.
import { reactive, computed } from 'vue'
import type { Floor, Project } from '@/types'
import { useDb, scheduleSave, type SaveState } from '@/db/sqlite'
import * as repo from '@/db/repo'
import type { ProjectData } from '@/db/repo'
import * as floorOps from './floors'
import type { Units } from './units'

export interface Settings {
  units: Units
  theme: 'system' | 'light' | 'dark'
  grid: number
  floorHeight: number
  slab: number
  wallInterior: number
  wallExterior: number
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  theme: 'system',
  grid: 0.1,
  floorHeight: 2.8,
  slab: 0.2,
  wallInterior: 0.15,
  wallExterior: 0.25
}

export const store = reactive({
  projects: [] as Project[],
  data: null as ProjectData | null,
  activeFloorId: '',
  settings: { ...DEFAULT_SETTINGS } as Settings,
  saveState: 'saved' as SaveState
})

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
}

export function closeProject() {
  store.data = null
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

export function removeFloor(id: string) {
  if (!store.data || store.data.floors.length < 2) return
  const floors = floorOps.removeFloor(store.data.floors.map(f => ({ ...f })), id)
  repo.remove(useDb(), 'floors', id) // cascades to everything on the floor
  for (const t of repo.FLOOR_TABLES) (store.data[t] as { floorId: string }[]) = store.data[t].filter(e => e.floorId !== id)
  if (store.activeFloorId === id) store.activeFloorId = (floors.find(f => f.level === 0) ?? floors[0]).id
  commitFloors(floors)
}
