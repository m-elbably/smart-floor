// Door and window tools: hover a wall to see a ghost, it slides along the wall in 5 cm steps,
// turns red where it would overlap another opening or run off the wall end. F flips a door.
import type { Opening, OpeningHost, Vec2 } from '@/types'
import { COLORS, type Shape } from '@/scene/overlay'
import { store, activeFloor, notify } from '../store'
import { execute, addEntity } from '../commands'
import { dist, projectOnSegment, segDistance, add, sub, scale, norm, lerp, dot } from '../geometry'
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

/**
 * Renders dimension lines and distance labels showing the distance
 * from the start and end of the host wall to the opening edges.
 */
export function openingDistanceGuides(host: OpeningHost, along: number, width: number, cursor?: Vec2 | null): Shape[] {
  if (!store.data) return []
  const line = hostLine(store.data, host)
  if (!line) return []
  const [p0, p1] = line
  const L = dist(p0, p1)
  if (L <= 0) return []

  const dir = norm(sub(p1, p0))
  const n: Vec2 = [-dir[1], dir[0]]

  // Offset dimension line toward the cursor side of the wall
  const side = cursor ? (dot(sub(cursor, p0), n) >= 0 ? 1 : -1) : 1
  const offDist = 0.35
  const offset = scale(n, side * offDist)

  const dStart = Math.max(0, along - width / 2)
  const dEnd = Math.max(0, L - (along + width / 2))

  const edgeStart = add(p0, scale(dir, dStart))
  const edgeEnd = add(p0, scale(dir, Math.min(L, along + width / 2)))

  const fromStart = add(p0, offset)
  const toStart = add(edgeStart, offset)
  const fromEnd = add(edgeEnd, offset)
  const toEnd = add(p1, offset)

  const tick = scale(n, side * 0.12)
  const shapes: Shape[] = []
  const u = store.settings.units

  // Start span dimension line & label
  if (dStart > 0.02) {
    shapes.push({ kind: 'line', points: [fromStart, toStart], color: COLORS.guide, width: 1.5 })
    shapes.push({ kind: 'line', points: [p0, add(fromStart, tick)], color: COLORS.guide, width: 1, dashed: true })
    shapes.push({ kind: 'line', points: [edgeStart, add(toStart, tick)], color: COLORS.guide, width: 1, dashed: true })
    shapes.push({ kind: 'label', at: lerp(fromStart, toStart, 0.5), text: format(dStart, u) })
  } else {
    shapes.push({ kind: 'label', at: fromStart, text: format(0, u) })
  }

  // End span dimension line & label
  if (dEnd > 0.02) {
    shapes.push({ kind: 'line', points: [fromEnd, toEnd], color: COLORS.guide, width: 1.5 })
    shapes.push({ kind: 'line', points: [edgeEnd, add(fromEnd, tick)], color: COLORS.guide, width: 1, dashed: true })
    shapes.push({ kind: 'line', points: [p1, add(toEnd, tick)], color: COLORS.guide, width: 1, dashed: true })
    shapes.push({ kind: 'label', at: lerp(fromEnd, toEnd, 0.5), text: format(dEnd, u) })
  } else {
    shapes.push({ kind: 'label', at: toEnd, text: format(0, u) })
  }

  // Ticks at wall endpoints
  shapes.push({ kind: 'dots', points: [p0, p1], color: COLORS.guide, size: 7 })

  return shapes
}

function makeTool(kind: 'door' | 'window') {
  let at: Placement | null = null
  let cur: Vec2 | null = null
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
      cur = e.raw
      at = placeOpening(e.raw, preset().width, e.ppm, !e.alt)
    },
    up(e) {
      if (e.moved) return
      cur = e.raw
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
      cur = null
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

      if (at.valid) {
        shapes.push(...openingDistanceGuides(at.host, at.along, p.width, cur))
      }

      const line = hostLine(store.data!, at.host)
      const L = line ? dist(line[0], line[1]) : 0
      const dStart = Math.max(0, at.along - p.width / 2)
      const dEnd = Math.max(0, L - (at.along + p.width / 2))
      const distInfo = L > 0 ? ` · ${format(dStart, store.settings.units)} | ${format(dEnd, store.settings.units)}` : ''

      const label = at.valid
        ? `${p.label}${distInfo}${kind === 'door' ? ` · hinge ${FLIPS[flip].hinge}, opens ${FLIPS[flip].swing}` : ` · sill ${format(p.sill, store.settings.units)}`}`
        : at.why!
      shapes.push({ kind: 'label', at: fp[2], text: label, tone: at.valid ? 'default' : 'error' })
      return shapes
    },
    hint: () => (kind === 'door' ? 'Hover a wall and click to place a door · F flips hinge/swing · Alt = free position' : 'Hover a wall and click to place a window · Alt = free position')
  })
}

makeTool('door')
makeTool('window')
