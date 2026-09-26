// Door and window tools: hover a wall to see a ghost, it slides along the wall in 5 cm steps,
// turns red where it would overlap another opening or run off the wall end. F flips a door.
import type { Opening, OpeningHost, Vec2 } from '@/types'
import { COLORS, type Shape } from '@/scene/overlay'
import { store, activeFloor, notify } from '../store'
import { execute, addEntity } from '../commands'
import { dist, projectOnSegment, segDistance } from '../geometry'
import { floorWalls, hostLine, openingOnWall, fitAlong, OPENING_MARGIN } from '../model'
import { DOOR_PRESETS, WINDOW_PRESETS } from '../presets'
import { format } from '../units'
import { registerTool, openingFootprint } from './index'

const STEP = 0.05
const FLIPS = [
  { hinge: 'left', swing: 'in' },
  { hinge: 'right', swing: 'in' },
  { hinge: 'right', swing: 'out' },
  { hinge: 'left', swing: 'out' }
]

export interface Placement {
  host: OpeningHost
  along: number
  valid: boolean
  why?: string
}

/**
 * Where an opening of `width` would go for a cursor point: nearest wall within reach, `along` snapped
 * and clamped, invalid when it can't fit or overlaps another opening on that wall (`ignoreId` excluded).
 */
export function placeOpening(raw: Vec2, width: number, ppm: number, snapStep: boolean, ignoreId?: string, keepHost?: OpeningHost): Placement | null {
  const data = store.data!
  const walls = floorWalls(data, activeFloor.value!.id, store.settings)
  let host = keepHost // dragging an existing opening: slide along its own wall wherever the cursor is
  if (!host) {
    let best = null as (typeof walls)[number] | null
    let bd = Math.max(0.4, 16 / ppm)
    for (const w of walls) {
      const d = segDistance(raw, w.a, w.b)
      if (d < bd) (bd = d), (best = w)
    }
    if (!best) return null
    host = best.wallId ? { wallId: best.wallId } : best.hosts[0]
  }
  const line = hostLine(data, host)
  if (!line) return null
  const L = dist(line[0], line[1])
  let along = projectOnSegment(raw, line[0], line[1]).t * L
  if (snapStep) along = Math.round(along / STEP) * STEP
  const fit = fitAlong(along, width, L)
  if (fit === null) return { host, along, valid: false, why: 'Wall too short' }
  const me = openingOnWall(data, { host, along: fit }, walls)
  const clash = data.openings.some(o => {
    if (o.id === ignoreId || o.floorId !== activeFloor.value!.id) return false
    const on = openingOnWall(data, o, walls)
    return on && me && on.wall.key === me.wall.key && Math.abs(on.center - me.center) < (o.width + width) / 2 + OPENING_MARGIN
  })
  return { host, along: fit, valid: !clash, why: clash ? 'Overlaps another opening' : undefined }
}

function makeTool(kind: 'door' | 'window') {
  let at: Placement | null = null
  let flip = 0
  const preset = () => {
    const presets = kind === 'door' ? DOOR_PRESETS : WINDOW_PRESETS
    const id = kind === 'door' ? store.toolOptions.door : store.toolOptions.window
    return { id, ...(presets[id] ?? Object.values(presets)[0]) }
  }

  registerTool({
    id: kind,
    snaps: () => false,
    move(e) {
      at = placeOpening(e.raw, preset().width, e.ppm, !e.alt)
    },
    up(e) {
      if (e.moved) return
      at = placeOpening(e.raw, preset().width, e.ppm, !e.alt)
      if (!at) return
      if (!at.valid) return notify(at.why ?? 'Cannot place here')
      const p = preset()
      const o: Opening = {
        id: crypto.randomUUID(),
        floorId: activeFloor.value!.id,
        host: at.host,
        along: at.along,
        kind,
        preset: p.id,
        width: p.width,
        height: p.height,
        sill: p.sill,
        props: kind === 'door' ? { ...FLIPS[flip] } : {}
      }
      execute(addEntity('openings', o, `Add ${kind}`))
    },
    key(e) {
      if (kind === 'door' && e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) return (flip = (flip + 1) % FLIPS.length), true
      return false
    },
    cancel() {
      at = null
    },
    preview() {
      if (!at) return []
      const p = preset()
      const fp = openingFootprint({ host: at.host, along: at.along, width: p.width })
      if (!fp) return []
      const color = at.valid ? COLORS.draw : COLORS.error
      const shapes: Shape[] = [
        { kind: 'fill', points: fp, color, opacity: 0.35 },
        { kind: 'line', points: fp, closed: true, color }
      ]
      const label = at.valid
        ? `${p.label}${kind === 'door' ? ` · hinge ${FLIPS[flip].hinge}, opens ${FLIPS[flip].swing}` : ` · sill ${format(p.sill, store.settings.units)}`}`
        : at.why!
      shapes.push({ kind: 'label', at: fp[2], text: label, tone: at.valid ? 'default' : 'error' })
      return shapes
    },
    hint: () => (kind === 'door' ? 'Hover a wall and click to place a door · F flips hinge/swing · Alt = free position' : 'Hover a wall and click to place a window · Alt = free position')
  })
}

makeTool('door')
makeTool('window')
