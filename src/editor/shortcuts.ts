// One keymap table: drives keyboard handling, the help overlay (?) and the command palette (Ctrl+K).
import { store } from './store'
import { undo, redo, history, execute, updateProjectCmd } from './commands'
import { setTool, cancelTool, onToolKey } from './tools'
import { copy, cut, paste, duplicate, deleteSelection } from './clipboard'
import { lastEvent } from './tools'
import type { ToolId } from './store'

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

export const TOOLS: { id: ToolId; label: string; icon: string; key: string }[] = [
  { id: 'select', label: 'Select', icon: 'i-lucide-mouse-pointer-2', key: 'v' },
  { id: 'rect', label: 'Rectangle room', icon: 'i-lucide-square', key: 'r' },
  { id: 'polygon', label: 'Polygon room', icon: 'i-lucide-pentagon', key: 'p' },
  { id: 'template', label: 'Room template', icon: 'i-lucide-stamp', key: 't' },
  { id: 'wall', label: 'Free wall', icon: 'i-lucide-brick-wall', key: 'w' },
  { id: 'door', label: 'Door', icon: 'i-lucide-door-open', key: 'd' },
  { id: 'window', label: 'Window', icon: 'i-lucide-app-window', key: 'n' },
  { id: 'stair', label: 'Stair', icon: 'i-lucide-footprints', key: 's' },
  { id: 'zone', label: 'Garden zone', icon: 'i-lucide-trees', key: 'g' },
  { id: 'site', label: 'Site boundary', icon: 'i-lucide-land-plot', key: 'b' }
]

const stepFloor = (dir: 1 | -1) => {
  const sorted = [...(store.data?.floors ?? [])].sort((a, b) => a.level - b.level)
  const next = sorted[sorted.findIndex(f => f.id === store.activeFloorId) + dir]
  if (next) store.activeFloorId = next.id
}

const hasSel = () => store.selection.length > 0

export const actions: Action[] = [
  ...TOOLS.map(t => ({ id: `tool.${t.id}`, label: t.label, group: 'Tools' as const, icon: t.icon, keys: [t.key], run: () => setTool(t.id) })),
  { id: 'undo', label: 'Undo', group: 'Edit', icon: 'i-lucide-undo-2', keys: ['ctrl+z'], run: undo, enabled: () => !!history.undo },
  { id: 'redo', label: 'Redo', group: 'Edit', icon: 'i-lucide-redo-2', keys: ['ctrl+shift+z', 'ctrl+y'], run: redo, enabled: () => !!history.redo },
  { id: 'copy', label: 'Copy', group: 'Edit', icon: 'i-lucide-copy', keys: ['ctrl+c'], run: () => void copy(), enabled: hasSel },
  { id: 'cut', label: 'Cut', group: 'Edit', icon: 'i-lucide-scissors', keys: ['ctrl+x'], run: cut, enabled: hasSel },
  { id: 'paste', label: 'Paste at cursor', group: 'Edit', icon: 'i-lucide-clipboard-paste', keys: ['ctrl+v'], run: () => paste(lastEvent()?.p) },
  { id: 'duplicate', label: 'Duplicate', group: 'Edit', icon: 'i-lucide-copy-plus', keys: ['ctrl+d'], run: duplicate, enabled: hasSel },
  { id: 'delete', label: 'Delete selection', group: 'Edit', icon: 'i-lucide-trash-2', keys: ['delete', 'backspace'], run: () => deleteSelection(), enabled: hasSel },
  {
    id: 'selectAll',
    label: 'Select all on this floor',
    group: 'Edit',
    icon: 'i-lucide-box-select',
    keys: ['ctrl+a'],
    run: () => {
      const d = store.data!
      store.selection = [...d.rooms, ...d.walls, ...d.openings, ...d.stairs, ...d.zones].filter(e => e.floorId === store.activeFloorId).map(e => e.id)
    }
  },
  {
    id: 'escape',
    label: 'Cancel / clear selection',
    group: 'Edit',
    keys: ['escape'],
    run: () => {
      cancelTool()
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
  { id: 'view', label: 'Switch 2D / 3D', group: 'View', icon: 'i-lucide-box', keys: ['tab'], run: () => (store.view = store.view === '2d' ? '3d' : '2d') },
  { id: 'labels', label: 'Toggle room labels', group: 'View', icon: 'i-lucide-tag', keys: ['l'], run: () => (store.showLabels = !store.showLabels) },
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
