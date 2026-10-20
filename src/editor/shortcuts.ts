// One keymap table: drives keyboard handling, the help overlay (?) and the command palette (Ctrl+K).
import { store } from './store'
import { undo, redo, history, execute, updateProjectCmd } from './commands'
import { setTool, cancelTool, onToolKey } from './tools'
import { copy, cut, paste, duplicate, deleteSelection } from './clipboard'
import { lastEvent } from './tools'
import type { ToolId } from './store'

import { openTemplates } from './templates'
import { rotateSelection } from './rotate'

export interface Action {
  id: string
  label: string
  group: 'Tools' | 'Edit' | 'View' | 'Floors'
  icon?: string
  /** Match strings, e.g. 'ctrl+z', 'shift+?', 'delete'. First one is shown. */
  keys?: string[]
  run: () => void
  enabled?: () => boolean
}

export const TOOLS: { id: ToolId; label: string; icon: string; key: string; group: string }[] = [
  { id: 'select', label: 'Select', icon: 'i-lucide-mouse-pointer-2', key: 'v', group: 'Edit' },
  { id: 'measure', label: 'Measure', icon: 'i-lucide-ruler', key: 'm', group: 'Edit' },
  { id: 'rect', label: 'Rectangle room', icon: 'i-lucide-square', key: 'r', group: 'Build' },
  { id: 'polygon', label: 'Polygon room', icon: 'i-lucide-pentagon', key: 'p', group: 'Build' },
  { id: 'template', label: 'Room template', icon: 'i-lucide-stamp', key: 't', group: 'Build' },
  { id: 'wall', label: 'Free wall', icon: 'i-lucide-brick-wall', key: 'w', group: 'Build' },
  { id: 'stair', label: 'Stair', icon: 'i-lucide-footprints', key: 's', group: 'Build' },
  { id: 'door', label: 'Door', icon: 'i-lucide-door-open', key: 'd', group: 'Build' },
  { id: 'window', label: 'Window', icon: 'i-lucide-app-window', key: 'n', group: 'Build' },
  { id: 'item', label: 'Furniture (catalog)', icon: 'i-lucide-armchair', key: 'f', group: 'Place' },
  { id: 'zone', label: 'Garden zone', icon: 'i-lucide-trees', key: 'g', group: 'Place' },
  { id: 'site', label: 'Site boundary', icon: 'i-lucide-land-plot', key: 'b', group: 'Place' }
]

export function openCatalog() {
  store.catalogOpen = true
  setTool('item')
}

const stepFloor = (dir: 1 | -1) => {
  const sorted = [...(store.data?.floors ?? [])].sort((a, b) => a.level - b.level)
  const next = sorted[sorted.findIndex(f => f.id === store.activeFloorId) + dir]
  if (next) store.activeFloorId = next.id
}

const hasSel = () => store.selection.length > 0

export const actions: Action[] = [
  ...TOOLS.map(t => ({
    id: `tool.${t.id}`,
    label: t.label,
    group: 'Tools' as const,
    icon: t.icon,
    keys: [t.key],
    run: () => (t.id === 'item' ? openCatalog() : t.id === 'template' ? openTemplates() : setTool(t.id))
  })),
  {
    id: 'saveRoomTemplate',
    label: 'Save selected room as template…',
    group: 'Edit',
    icon: 'i-lucide-bookmark-plus',
    run: () => (store.ui.saveTemplate = true),
    enabled: () => store.selection.length === 1 && (store.data?.rooms.some(r => r.id === store.selection[0]) ?? false)
  },
  { id: 'undo', label: 'Undo', group: 'Edit', icon: 'i-lucide-undo-2', keys: ['ctrl+z'], run: undo, enabled: () => !!history.undo },
  { id: 'redo', label: 'Redo', group: 'Edit', icon: 'i-lucide-redo-2', keys: ['ctrl+shift+z', 'ctrl+y'], run: redo, enabled: () => !!history.redo },
  { id: 'copy', label: 'Copy', group: 'Edit', icon: 'i-lucide-copy', keys: ['ctrl+c'], run: () => void copy(), enabled: hasSel },
  { id: 'cut', label: 'Cut', group: 'Edit', icon: 'i-lucide-scissors', keys: ['ctrl+x'], run: cut, enabled: hasSel },
  { id: 'paste', label: 'Paste at cursor', group: 'Edit', icon: 'i-lucide-clipboard-paste', keys: ['ctrl+v'], run: () => paste(lastEvent()?.p) },
  { id: 'duplicate', label: 'Duplicate', group: 'Edit', icon: 'i-lucide-copy-plus', keys: ['ctrl+d'], run: duplicate, enabled: hasSel },
  { id: 'rotateCw', label: 'Rotate selection clockwise (+15°)', group: 'Edit', icon: 'i-lucide-rotate-cw', run: () => rotateSelection(15), enabled: hasSel },
  { id: 'rotateCcw', label: 'Rotate selection counter-clockwise (-15°)', group: 'Edit', icon: 'i-lucide-rotate-ccw', run: () => rotateSelection(-15), enabled: hasSel },
  { id: 'delete', label: 'Delete selection', group: 'Edit', icon: 'i-lucide-trash-2', keys: ['delete', 'backspace'], run: () => deleteSelection(), enabled: hasSel },
  {
    id: 'selectAll',
    label: 'Select all on this floor',
    group: 'Edit',
    icon: 'i-lucide-box-select',
    keys: ['ctrl+a'],
    run: () => {
      const d = store.data!
      store.selection = [...d.rooms, ...d.walls, ...d.openings, ...d.stairs, ...d.zones, ...d.items].filter(e => e.floorId === store.activeFloorId).map(e => e.id)
    }
  },
  {
    id: 'escape',
    label: 'Cancel / clear selection',
    group: 'Edit',
    keys: ['escape'],
    run: () => {
      if (store.view === 'walk') return void (store.view = '3d')
      cancelTool()
      if (store.catalogOpen) {
        store.catalogOpen = false
        if (store.tool === 'item') setTool('select')
        return
      }
      if (store.tool !== 'select') setTool('select')
      else store.selection = []
    }
  },
  {
    id: 'clearSite',
    label: 'Clear site boundary',
    group: 'Edit',
    icon: 'i-lucide-land-plot',
    run: () => execute(updateProjectCmd({ site: null }, 'Clear site boundary')),
    enabled: () => !!store.data?.project.site
  },
  { id: 'view', label: 'Cycle 2D → 3D → Walk', group: 'View', icon: 'i-lucide-box', keys: ['tab'], run: () => (store.view = ({ '2d': '3d', '3d': 'walk', walk: '2d' } as const)[store.view]) },
  { id: 'fit', label: 'Reset view', group: 'View', icon: 'i-lucide-scan', keys: ['home'], run: () => store.ui.fit++, enabled: () => store.view !== 'walk' },
  { id: 'walk', label: 'Walk through', group: 'View', icon: 'i-lucide-person-standing', run: () => (store.view = 'walk') },
  { id: 'dims', label: 'Toggle wall dimensions', group: 'View', icon: 'i-lucide-ruler-dimension-line', keys: ['shift+d'], run: () => (store.showDims = !store.showDims) },
  { id: 'labels', label: 'Toggle room labels', group: 'View', icon: 'i-lucide-tag', keys: ['l'], run: () => (store.showLabels = !store.showLabels) },
  { id: 'summary', label: 'Areas & summary', group: 'View', icon: 'i-lucide-sigma', keys: ['shift+s'], run: () => (store.ui.summary = !store.ui.summary) },
  { id: 'help', label: 'Keyboard shortcuts', group: 'View', icon: 'i-lucide-keyboard', keys: ['?'], run: () => (store.ui.help = true) },
  { id: 'palette', label: 'Command palette', group: 'View', icon: 'i-lucide-search', keys: ['ctrl+k'], run: () => (store.ui.palette = true) },
  { id: 'floorUp', label: 'Floor above', group: 'Floors', icon: 'i-lucide-chevron-up', keys: ['pageup'], run: () => stepFloor(1) },
  { id: 'floorDown', label: 'Floor below', group: 'Floors', icon: 'i-lucide-chevron-down', keys: ['pagedown'], run: () => stepFloor(-1) }
]

/** 'ctrl+shift+z' style id for an event. Shift is dropped for symbol keys ('?' not 'shift+?'). */
export function comboOf(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  const symbol = k.length === 1 && !/[a-z0-9]/.test(k)
  return [(e.ctrlKey || e.metaKey) && 'ctrl', e.altKey && 'alt', e.shiftKey && !symbol && 'shift', k === ' ' ? 'space' : k].filter(Boolean).join('+')
}

/** Kbd tokens for Nuxt UI's UKbd ('ctrl' shows as Ctrl / ⌘). */
export const kbds = (combo: string) => combo.split('+').map(k => (k === 'ctrl' ? 'meta' : k))

/** Handle a keydown for the editor. The active tool gets it first (typed lengths, R, F, Enter…). */
export function handleKey(e: KeyboardEvent): boolean {
  if (onToolKey(e)) return true
  const combo = comboOf(e)
  const a = actions.find(a => a.keys?.includes(combo))
  if (!a || (a.enabled && !a.enabled())) return false
  a.run()
  return true
}
