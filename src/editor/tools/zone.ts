// Garden zones (grass, patio, path, driveway, pool) and the project's site boundary — both drawn with the polygon tool.
import type { Zone } from '@/types'
import { store, activeFloor } from '../store'
import { execute, addEntity, updateProjectCmd } from '../commands'
import { ensureCCW } from '../geometry'
import { ZONE_KINDS, POOL_DEPTH } from '../presets'
import { polygonTool } from './room'

polygonTool({
  id: 'zone',
  color: '#65a30d',
  first: 'Click to start a garden zone (grass, patio, path, driveway or pool)',
  done(poly) {
    const kind = (store.toolOptions.zone in ZONE_KINDS ? store.toolOptions.zone : 'grass') as Zone['kind']
    const zone: Zone = {
      id: crypto.randomUUID(),
      floorId: activeFloor.value!.id,
      kind,
      polygon: ensureCCW(poly),
      props: kind === 'pool' ? { depth: POOL_DEPTH } : {}
    }
    execute(addEntity('zones', zone, `Add ${ZONE_KINDS[kind].label.toLowerCase()}`))
    store.selection = [zone.id]
  }
})

polygonTool({
  id: 'site',
  color: '#f59e0b',
  first: 'Click to outline the plot (site boundary); drawing again replaces it',
  done(poly) {
    execute(updateProjectCmd({ site: ensureCCW(poly) }, 'Set site boundary'))
  }
})
