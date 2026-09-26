// Keeps the three.js scene in step with the store: rooms rebuild by id when their data changes,
// each floor's walls+openings rebuild as one group when anything feeding them changes.
import { watch } from 'vue'
import type * as THREE from 'three'
import { store } from '@/editor/store'
import { formatArea } from '@/editor/units'
import { area } from '@/editor/geometry'
import { floorWalls, hostLine, openingOnWall, stairRise } from '@/editor/model'
import { solve, toPlan, stairwellHoles } from '@/editor/stairs'
import { isConvex } from '@/editor/geometry'
import { buildRoom, buildWalls, buildStair, buildZone, buildSite, dispose, openingFrame, type PlacedOpening } from './builders'
import { ZONE_KINDS } from '@/editor/presets'
import type { Viewport } from './viewport'

export function attachScene(vp: Viewport) {
  const rooms = new Map<string, { key: string; obj: THREE.Object3D }>()
  const walls = new Map<string, { key: string; obj: THREE.Object3D }>()
  const stairs = new Map<string, { key: string; obj: THREE.Object3D }>()
  const zones = new Map<string, { key: string; obj: THREE.Object3D }>()
  let site: { key: string; obj: THREE.Object3D } | null = null

  function rebuild() {
    const data = store.data
    const s = store.settings
    const seen = new Set<string>()

    // Stairs, and the stairwell pieces they cut into the floor above.
    const wells = new Map<number, [number, number][][]>() // floor level above → footprint pieces
    for (const st of data?.stairs ?? []) {
      const floor = data!.floors.find(f => f.id === st.floorId)
      if (!floor) continue
      seen.add(st.id)
      const rise = stairRise(data!, st.floorId, s.slab)
      const sol = solve(st.kind, st.params, rise)
      const list = wells.get(floor.level + 1) ?? []
      list.push(...sol.pieces.map(pc => toPlan(st, pc)))
      wells.set(floor.level + 1, list)
      const key = JSON.stringify([st, rise])
      if (stairs.get(st.id)?.key === key) continue
      const old = stairs.get(st.id)
      if (old) dispose(old.obj)
      const obj = buildStair(st, sol, rise)
      vp.floorGroup(st.floorId).add(obj)
      stairs.set(st.id, { key, obj })
    }
    for (const [id, v] of stairs) if (!seen.has(id)) (dispose(v.obj), stairs.delete(id))

    // ponytail: only convex pools cut their lawn/paving; a concave pool would need a real polygon boolean.
    const pools = (data?.zones ?? []).filter(z => z.kind === 'pool' && isConvex(z.polygon))
    for (const z of data?.zones ?? []) {
      seen.add(z.id)
      const holes = z.kind === 'pool' ? [] : stairwellHoles(z.polygon, pools.filter(p => p.floorId === z.floorId).map(p => p.polygon))
      const key = JSON.stringify([z, s.units, holes])
      if (zones.get(z.id)?.key === key) continue
      const old = zones.get(z.id)
      if (old) dispose(old.obj)
      const obj = buildZone(z, { title: ZONE_KINDS[z.kind]?.label ?? z.kind, sub: formatArea(area(z.polygon), s.units) }, holes)
      vp.floorGroup(z.floorId).add(obj)
      zones.set(z.id, { key, obj })
    }
    for (const [id, v] of zones) if (!seen.has(id)) (dispose(v.obj), zones.delete(id))

    // Site boundary lives on the ground floor.
    const sitePoly = data?.project.site
    const ground = data?.floors.find(f => f.level === 0)
    const siteKey = JSON.stringify([sitePoly, ground?.id])
    if (site?.key !== siteKey) {
      if (site) dispose(site.obj)
      site = null
      if (sitePoly && ground) {
        site = { key: siteKey, obj: buildSite(sitePoly) }
        vp.floorGroup(ground.id).add(site.obj)
      }
    }

    for (const r of data?.rooms ?? []) {
      const floor = data!.floors.find(f => f.id === r.floorId)
      if (!floor) continue
      seen.add(r.id)
      const holes = stairwellHoles(r.polygon, wells.get(floor.level) ?? [])
      const key = JSON.stringify([r, floor.slab, floor.height, s.units, holes])
      if (rooms.get(r.id)?.key === key) continue
      const old = rooms.get(r.id)
      if (old) dispose(old.obj)
      const a = area(r.polygon)
      const obj = buildRoom(r, floor, { title: r.name, sub: formatArea(a, s.units) }, holes)
      vp.floorGroup(r.floorId).add(obj)
      rooms.set(r.id, { key, obj })
    }
    for (const [id, v] of rooms) if (!seen.has(id)) (dispose(v.obj), rooms.delete(id))

    const floorsSeen = new Set<string>()
    for (const f of data?.floors ?? []) {
      floorsSeen.add(f.id)
      const views = floorWalls(data!, f.id, s)
      const placed: PlacedOpening[] = []
      for (const o of data!.openings) {
        if (o.floorId !== f.id) continue
        const on = openingOnWall(data!, o, views)
        const line = hostLine(data!, o.host)
        if (on && line) placed.push({ opening: o, wallKey: on.wall.key, center: on.center, ...openingFrame(line[0], line[1], on.wall) })
      }
      const key = JSON.stringify([views, placed])
      if (walls.get(f.id)?.key === key) continue
      const old = walls.get(f.id)
      if (old) dispose(old.obj)
      const obj = buildWalls(views, placed)
      vp.floorGroup(f.id).add(obj)
      walls.set(f.id, { key, obj })
    }
    for (const [id, v] of walls) if (!floorsSeen.has(id)) (dispose(v.obj), walls.delete(id))

    // Drop selection/hover that no longer exists (after undo, delete, floor removal).
    const exists = (id: string) => !!data && (['rooms', 'walls', 'openings', 'stairs', 'zones'] as const).some(t => data[t].some(e => e.id === id))
    if (store.selection.some(id => !exists(id))) store.selection = store.selection.filter(exists)
    vp.requestRender()
  }

  const stop = watch(
    () => [store.data, store.settings.units, store.settings.wallInterior, store.settings.wallExterior, store.settings.slab],
    rebuild,
    { deep: true, immediate: true }
  )
  const stopLabels = watch(
    () => store.showLabels,
    v => (vp.labelsEl.classList.toggle('hide-room-labels', !v), vp.requestRender()),
    { immediate: true }
  )
  return () => {
    stop()
    stopLabels()
    for (const v of [...rooms.values(), ...walls.values(), ...stairs.values(), ...zones.values()]) dispose(v.obj)
    if (site) dispose(site.obj)
  }
}
