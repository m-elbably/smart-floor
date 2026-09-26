// Pure floor-stack logic. Elevation = finished floor level; each floor's slab sits beneath it.
// elev(n) = elev(n-1) + height(n-1) + slab(n); the ground floor (level 0) is at 0.
import type { Floor } from '@/types'

type F = Pick<Floor, 'id' | 'level' | 'height' | 'slab'> & { elevation: number }

/** Renumber levels in list order (ground = index `groundIndex`) and recompute elevations. Mutates and returns `floors`. */
export function restack<T extends F>(floors: T[], groundIndex: number): T[] {
  floors.forEach((f, i) => (f.level = i - groundIndex))
  const g = floors[groundIndex] ?? floors[0]
  if (!g) return floors
  g.elevation = 0
  for (let i = floors.indexOf(g) + 1; i < floors.length; i++)
    floors[i].elevation = floors[i - 1].elevation + floors[i - 1].height + floors[i].slab
  for (let i = floors.indexOf(g) - 1; i >= 0; i--)
    floors[i].elevation = floors[i + 1].elevation - floors[i + 1].slab - floors[i].height
  return floors
}

export const sortByLevel = <T extends F>(floors: T[]) => [...floors].sort((a, b) => a.level - b.level)
export const groundIndexOf = (sorted: F[]) => sorted.filter(f => f.level < 0).length

/** Move a floor up (+1) or down (-1) in the stack, keeping the number of basements fixed. */
export function moveFloor<T extends F>(floors: T[], id: string, dir: 1 | -1): T[] {
  const sorted = sortByLevel(floors)
  const ground = groundIndexOf(sorted)
  const i = sorted.findIndex(f => f.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return sorted
  ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
  return restack(sorted, ground)
}

/** Insert a floor on top (`above`) or at the bottom as a basement. */
export function addFloor<T extends F>(floors: T[], floor: T, where: 'above' | 'below'): T[] {
  const sorted = sortByLevel(floors)
  const ground = groundIndexOf(sorted)
  if (where === 'above') return restack([...sorted, floor], ground)
  return restack([floor, ...sorted], ground + 1)
}

export function removeFloor<T extends F>(floors: T[], id: string): T[] {
  const sorted = sortByLevel(floors)
  const gone = sorted.find(f => f.id === id)
  if (!gone || sorted.length === 1) return sorted
  const ground = groundIndexOf(sorted) - (gone.level < 0 ? 1 : 0)
  return restack(sorted.filter(f => f !== gone), Math.min(ground, sorted.length - 2))
}

export function defaultFloorName(level: number): string {
  if (level === 0) return 'Ground Floor'
  if (level < 0) return level === -1 ? 'Basement' : `Basement ${-level}`
  const n = level
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix} Floor`
}
