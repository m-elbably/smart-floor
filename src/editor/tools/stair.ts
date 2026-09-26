// Stair tool: ghost footprint follows the cursor (bottom-centre of the first step), R rotates 90°,
// click places. On the top floor it asks whether to add a floor above for the stair to reach.
import type { Stair, Vec2 } from '@/types'
import { COLORS } from '@/scene/overlay'
import { store, activeFloor, addFloor, notify } from '../store'
import { execute, addEntity } from '../commands'
import { solve, toPlan, defaultSteps, DEFAULT_PARAMS, type StairKind } from '../stairs'
import { stairRise } from '../model'
import { format } from '../units'
import { registerTool } from './index'
import { stairShapes, warningText } from './shapes'

let cur: Vec2 | null = null
let turns = 0

function draft(): Stair {
  const kind = store.toolOptions.stair as StairKind
  const rise = stairRise(store.data!, activeFloor.value!.id, store.settings.slab)
  return {
    id: crypto.randomUUID(),
    floorId: activeFloor.value!.id,
    kind,
    x: cur![0],
    y: cur![1],
    rotation: turns * 90,
    params: { ...DEFAULT_PARAMS, steps: defaultSteps(rise, kind) }
  }
}

function commit(s: Stair) {
  execute(addEntity('stairs', s, 'Add stair'))
  store.selection = [s.id]
  const sol = solve(s.kind, s.params, stairRise(store.data!, s.floorId, store.settings.slab))
  if (sol.warnings.length) notify(warningText(sol.warnings[0]))
}

registerTool({
  id: 'stair',
  move(e) {
    cur = e.p
  },
  up(e) {
    if (e.moved || !cur) return
    const s = draft()
    const here = activeFloor.value!
    if (store.data!.floors.some(f => f.level === here.level + 1)) return commit(s)
    store.ui.confirm = {
      title: 'This is the top floor',
      text: 'A stair here leads up to nothing yet. Add a floor above for it to reach?',
      yes: 'Add floor above',
      no: 'Place stair only',
      onYes: () => {
        addFloor('above')
        store.activeFloorId = here.id // stay on the floor being drawn
        commit(s)
      },
      onNo: () => commit(s)
    }
  },
  key(e) {
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) return (turns = (turns + 1) % 4), true
    return false
  },
  cancel() {
    cur = null
  },
  preview() {
    if (!cur) return []
    const s = draft()
    const sol = solve(s.kind, s.params, stairRise(store.data!, s.floorId, store.settings.slab))
    const bad = sol.warnings.length > 0
    return [
      { kind: 'fill', points: toPlan(s, sol.footprint), color: COLORS.draw },
      ...stairShapes(s, COLORS.draw),
      {
        kind: 'label',
        at: toPlan(s, [sol.walk.at(-1)!])[0],
        text: `${sol.steps} steps · rise ${format(sol.rise, store.settings.units)}${bad ? ' ⚠' : ''}`,
        tone: bad ? 'error' : 'default'
      }
    ]
  },
  hint: () => 'Click to place the bottom step · R rotates · stairs climb to the floor above'
})
