// .smartfloor project files: a standalone SQLite database holding one project (FR-113).
import * as repo from '@/db/repo'
import { newDatabase, useDb, scheduleSave } from '@/db/sqlite'

/** Bytes of a new database containing just this project. */
export async function exportProject(projectId: string): Promise<Uint8Array> {
  const data = repo.loadProject(useDb(), projectId)
  if (!data) throw new Error('Project not found')
  const db = await newDatabase()
  try {
    repo.migrate(db)
    repo.tx(db, () => repo.insertProjectData(db, data))
    return repo.exportDb(db)
  } finally {
    db.close()
  }
}

/** Import every project in a .smartfloor file with fresh ids. Returns the new project ids. */
export async function importProject(bytes: Uint8Array): Promise<string[]> {
  const src = await newDatabase(bytes)
  const ids: string[] = []
  try {
    src.exec('PRAGMA integrity_check')
    repo.migrate(src) // older files come up to the current schema
    const main = useDb()
    for (const p of repo.listProjects(src)) {
      const full = repo.loadProject(src, p.id)!
      const { project, ...rest } = full
      const { data } = repo.remapIds(rest)
      const now = Date.now()
      const copy = { ...project, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      for (const f of data.floors) f.projectId = copy.id
      repo.tx(main, () => repo.insertProjectData(main, { project: copy, ...data }))
      ids.push(copy.id)
    }
  } finally {
    src.close()
  }
  scheduleSave()
  return ids
}
