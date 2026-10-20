import type { Item, Room, Vec2 } from '@/types'
import { bbox, pointInPolygon, area } from './geometry'
import { TEMPLATES, type RoomTemplate, type RoomTemplateItem } from './presets'
import { store, notify, saveCustomTemplate, deleteCustomTemplate } from './store'
import { format } from './units'
import { setTool } from './tools'

export { type RoomTemplate, type RoomTemplateItem } from './presets'

export const KIND_ICONS: Record<string, string> = {
  generic: 'i-lucide-rectangle-horizontal',
  living: 'i-lucide-armchair',
  bedroom: 'i-lucide-bed-double',
  kitchen: 'i-lucide-cooking-pot',
  bathroom: 'i-lucide-bath',
  dining: 'i-lucide-utensils',
  office: 'i-lucide-briefcase',
  hallway: 'i-lucide-footprints',
  garage: 'i-lucide-car',
  storage: 'i-lucide-archive',
  outdoor: 'i-lucide-trees'
}

/** Get a room template by id from custom templates or built-in presets (fallback: rect). */
export function getTemplate(id?: string): RoomTemplate {
  if (!id) return TEMPLATES.rect
  if (store.customTemplates?.length) {
    const custom = store.customTemplates.find(t => t.id === id)
    if (custom) return custom
  }
  return TEMPLATES[id] ?? TEMPLATES.rect
}

/** Returns all available room templates: built-ins first, then custom templates (newest first). */
export function allTemplates(): RoomTemplate[] {
  const builtin = Object.values(TEMPLATES)
  const custom = [...(store.customTemplates ?? [])].reverse()
  return [...builtin, ...custom]
}

export interface ExtractTemplateOptions {
  name?: string
  label?: string
  kind?: string
  icon?: string
  includeItems?: boolean
}

/**
 * Extracts a reusable RoomTemplate from an existing Room and its placed furniture items.
 * The room polygon is centered around [0, 0] (center of its bounding box),
 * and any items inside the room on the same floor are shifted by the same center offset.
 */
export function extractRoomAsTemplate(
  room: Room,
  items: Item[],
  options: ExtractTemplateOptions = {}
): RoomTemplate {
  const b = bbox(room.polygon)
  const center: Vec2 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]

  // Center polygon around [0, 0]
  const polygon: Vec2[] = room.polygon.map(p => [
    Math.round((p[0] - center[0]) * 1000) / 1000,
    Math.round((p[1] - center[1]) * 1000) / 1000
  ])

  // Find furniture items inside this room's polygon on the same floor
  const insideItems =
    options.includeItems !== false
      ? items.filter(it => it.floorId === room.floorId && pointInPolygon([it.x, it.y], room.polygon))
      : []

  const templateItems: RoomTemplateItem[] = insideItems.map(it => ({
    catalogId: it.catalogId,
    at: [
      Math.round((it.x - center[0]) * 1000) / 1000,
      Math.round((it.y - center[1]) * 1000) / 1000
    ],
    rotation: it.rotation,
    z: it.z || undefined,
    scale: it.scale,
    variant: it.variant,
    name: it.name
  }))

  const kind = options.kind || room.kind || 'generic'
  const name = options.name?.trim() || room.name || 'Room'
  const w = Math.round((b.max[0] - b.min[0]) * 10) / 10
  const d = Math.round((b.max[1] - b.min[1]) * 10) / 10
  const label =
    options.label?.trim() ||
    `${name} ${format(w, store.settings.units)} × ${format(d, store.settings.units)}`
  const icon = options.icon || KIND_ICONS[kind] || 'i-lucide-stamp'

  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  return {
    id,
    label,
    icon,
    kind,
    name,
    floorMaterial: room.floorMaterial || 'wood',
    wallColor: room.wallColor || '#f2efe9',
    polygon,
    items: templateItems,
    custom: true,
    createdAt: Date.now()
  }
}

/** Extracts and persists the room as a custom template, sets it as the active template tool option. */
export function saveRoomAsTemplate(
  room: Room,
  items: Item[],
  options: ExtractTemplateOptions = {}
): RoomTemplate {
  const template = extractRoomAsTemplate(room, items, options)
  saveCustomTemplate(template)
  store.toolOptions.template = template.id!
  notify(`Saved "${template.name}" to templates`)
  return template
}

/** Delete a custom template. */
export function deleteTemplate(id: string) {
  deleteCustomTemplate(id)
}

/** Opens the room templates dialog and arms the template tool. */
export function openTemplates() {
  setTool('template')
  store.ui.templates = true
}

/** Dimensions [width, depth, area] of a template polygon. */
export function templateStats(polygon: Vec2[]): { width: number; depth: number; area: number } {
  const b = bbox(polygon)
  return {
    width: Math.abs(b.max[0] - b.min[0]),
    depth: Math.abs(b.max[1] - b.min[1]),
    area: area(polygon)
  }
}
