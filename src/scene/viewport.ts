// Renderer, cameras, input for the 2D camera, 2D↔3D tween and floor groups. Renders on demand only.
// Plan (x, y) maps to world (x, elevation, -y), so plan +y is screen-up in 2D.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createGrid } from './grid'
import type { Vec2 } from '@/types'

export type View = '2d' | '3d' | 'walk'
export type FloorVisibility = 'active' | 'ghost' | 'all'
export type Preset = 'top' | 'front' | 'iso'
type Vis = 'normal' | 'ghost' | 'hidden'

const FOV = 50
const TWEEN_MS = 350
const PPM = { min: 2, max: 2000 }
const BG = { light: 0xf4f4f5, dark: 0x18181b }
const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export const toWorld = (p: Vec2, elevation = 0) => new THREE.Vector3(p[0], elevation, -p[1])

/** Object layers: 0 = always, plan = 2D only, model = 3D only, ceiling = walk only, pick = raycast only. */
export const LAYER = { ceiling: 1, plan: 2, model: 3, pick: 4 } as const

export type PointerKind = 'down' | 'move' | 'up' | 'dblclick' | 'leave'
/** Return true from 'down' to claim the drag (orbit is suspended until 'up'). */
export type PointerHandler = (kind: PointerKind, e: MouseEvent, raw: Vec2 | null) => boolean | void

export function createViewport(el: HTMLElement, onPointer: PointerHandler) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false // once per frame, not once per pass (a second pass broke line depth)
  renderer.domElement.style.display = 'block'
  const labels = new CSS2DRenderer()
  labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none'
  el.append(renderer.domElement, labels.domElement)
  const canvas = renderer.domElement

  const scene = new THREE.Scene()
  const floorsRoot = new THREE.Group()
  const overlay = new THREE.Group()
  const grid = createGrid()
  scene.add(floorsRoot, overlay, grid.object)

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 2)
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(15, 30, 10)
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0005
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 })
  scene.add(hemi, sun, sun.target)

  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.25, depthWrite: false })

  // ---------- cameras ----------
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
  ortho.up.set(0, 0, -1)
  ortho.layers.enable(LAYER.plan)
  const persp = new THREE.PerspectiveCamera(FOV, 1, 0.05, 2000)
  persp.layers.enable(LAYER.model)
  const orbit = new OrbitControls(persp, canvas)
  orbit.enableDamping = true
  orbit.enabled = false
  orbit.maxPolarAngle = Math.PI / 2 - 0.02
  orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }
  orbit.addEventListener('change', requestRender)

  const s = { view: '2d' as View, center: [0, 0] as Vec2, ppm: 50, elevation: 0, w: 1, h: 1, space: false }
  const camera = () => (s.view === '2d' ? ortho : persp)
  const walking = () => s.view === 'walk'
  let exporting = false
  const distFor = (ppm: number) => s.h / (2 * ppm * halfTan)
  const ppmFor = (dist: number) => s.h / (2 * dist * halfTan)

  function updateOrtho() {
    Object.assign(ortho, { left: -s.w / 2, right: s.w / 2, top: s.h / 2, bottom: -s.h / 2, zoom: s.ppm })
    ortho.position.set(s.center[0], s.elevation + 100, -s.center[1])
    ortho.lookAt(s.center[0], s.elevation, -s.center[1])
    ortho.updateProjectionMatrix()
  }

  // ---------- tween (perspective camera only) ----------
  type Pose = { pos: THREE.Vector3; target: THREE.Vector3 }
  let tween: { from: Pose; to: Pose; t0: number; done?: () => void } | null = null
  const pose = (target: THREE.Vector3, dir: [number, number, number], dist: number): Pose => ({
    target,
    pos: target.clone().add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist))
  })
  // Top pose keeps a hair of +z tilt so lookAt stays defined and screen-up matches the 2D plan.
  const presets: Record<Preset, [number, number, number]> = { top: [0, 1, 0.001], front: [0, 0.35, 1], iso: [1, 0.9, 1] }

  function tweenTo(to: Pose, done?: () => void) {
    orbit.enabled = false
    tween = { from: { pos: persp.position.clone(), target: orbit.target.clone() }, to, t0: performance.now(), done }
    requestRender()
  }

  function finishTween() {
    if (!tween) return
    tween.t0 = -Infinity
    frame(performance.now())
  }

  function setView(view: View) {
    finishTween()
    if (view === s.view) return
    if (s.view === 'walk') {
      // leave first person: orbit around a point a few metres ahead, at floor level
      persp.layers.disable(LAYER.ceiling)
      const ahead = persp.getWorldDirection(new THREE.Vector3()).setY(0).normalize().multiplyScalar(4)
      orbit.target.copy(persp.position).add(ahead).setY(s.elevation)
      persp.position.y = Math.max(persp.position.y, s.elevation + 4)
      persp.lookAt(orbit.target)
      s.view = '3d'
      orbit.enabled = view === '3d'
      refloor()
      syncShadows()
      if (view === '3d') return requestRender()
    }
    if (view === 'walk') {
      s.view = 'walk'
      orbit.enabled = false
      persp.layers.enable(LAYER.ceiling)
      refloor()
      syncShadows()
      return requestRender()
    }
    if (view === '3d') {
      const target = toWorld(s.center, s.elevation)
      const d = distFor(s.ppm)
      const top = pose(target, presets.top, d)
      persp.position.copy(top.pos)
      orbit.target.copy(target)
      persp.lookAt(target)
      s.view = '3d'
      refloor()
      tweenTo(pose(target.clone(), presets.iso, d), () => (orbit.enabled = true))
    } else {
      const d = persp.position.distanceTo(orbit.target)
      const target = orbit.target.clone().setY(s.elevation)
      tweenTo(pose(target, presets.top, d), () => {
        s.center = [target.x, -target.z]
        s.ppm = THREE.MathUtils.clamp(ppmFor(d), PPM.min, PPM.max)
        s.view = '2d'
        updateOrtho()
        refloor()
      })
    }
    syncShadows()
  }

  function preset(p: Preset) {
    setView('3d')
    const target = tween ? tween.to.target : orbit.target.clone()
    const to = pose(target, presets[p], persp.position.distanceTo(orbit.target))
    if (tween) tween.to = to // redirect the 2D→3D tween that just started
    else tweenTo(to, () => (orbit.enabled = true))
  }

  // ---------- 2D pan / zoom ----------
  function pan(dx: number, dy: number) {
    if (s.view !== '2d' || tween) return
    s.center = [s.center[0] - dx / s.ppm, s.center[1] + dy / s.ppm]
    updateOrtho()
    requestRender()
  }

  let panning: { x: number; y: number } | null = null
  let gesture = false
  const capture = (id: number) => {
    try {
      canvas.setPointerCapture(id)
    } catch {
      /* pointer already released (synthetic or lost) — the drag still works without capture */
    }
  }
  let guard: (() => boolean) | null = null
  // Capture phase on the container, so a claimed drag can switch orbit off before OrbitControls sees it.
  function onPointerDown(e: PointerEvent) {
    if (e.target !== canvas) return
    ;(document.activeElement as HTMLElement | null)?.blur() // hand the keyboard back to the viewport
    if (s.view === '2d' && (e.button === 1 || (e.button === 0 && s.space))) {
      e.preventDefault()
      panning = { x: e.clientX, y: e.clientY }
      capture(e.pointerId)
      canvas.style.cursor = 'grabbing'
      return
    }
    if (e.button !== 0 || tween || walking()) return
    if (s.view === '3d' && guard?.()) {
      gesture = true // a gizmo handle has the pointer: no tool, no orbit
      orbit.enabled = false
      return
    }
    if (onPointer('down', e, planAt(e.offsetX, e.offsetY))) {
      gesture = true
      orbit.enabled = false
      capture(e.pointerId)
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (panning) {
      pan(e.clientX - panning.x, e.clientY - panning.y)
      panning = { x: e.clientX, y: e.clientY }
    } else if (!walking()) onPointer('move', e, planAt(e.offsetX, e.offsetY))
  }
  function onPointerUp(e: PointerEvent) {
    if (panning) {
      panning = null
      canvas.style.cursor = s.space ? 'grab' : ''
      return
    }
    if (e.button === 0 && !walking() && !(s.view === '3d' && guard?.())) onPointer('up', e, planAt(e.offsetX, e.offsetY))
    if (gesture) {
      gesture = false
      orbit.enabled = s.view === '3d' && !tween
    }
  }
  function onWheel(e: WheelEvent) {
    if (s.view !== '2d' || tween) return
    e.preventDefault()
    const px = e.offsetX - s.w / 2
    const py = e.offsetY - s.h / 2
    const before: Vec2 = [s.center[0] + px / s.ppm, s.center[1] - py / s.ppm]
    s.ppm = THREE.MathUtils.clamp(s.ppm * Math.exp(-e.deltaY * 0.0015), PPM.min, PPM.max)
    s.center = [before[0] - px / s.ppm, before[1] + py / s.ppm] // keep the point under the cursor fixed
    updateOrtho()
    requestRender()
  }
  el.addEventListener('pointerdown', onPointerDown, { capture: true })
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointerleave', e => onPointer('leave', e, null))
  canvas.addEventListener('dblclick', e => onPointer('dblclick', e, planAt(e.offsetX, e.offsetY)))
  canvas.addEventListener('contextmenu', e => e.preventDefault())
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('auxclick', e => e.preventDefault())

  function setSpace(down: boolean) {
    s.space = down
    if (!panning) canvas.style.cursor = down && s.view === '2d' ? 'grab' : ''
  }

  // ---------- picking onto the active floor plane ----------
  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
  const hit = new THREE.Vector3()
  function aim(x: number, y: number) {
    ray.setFromCamera(new THREE.Vector2((x / s.w) * 2 - 1, -(y / s.h) * 2 + 1), camera())
  }
  function planAt(x: number, y: number): Vec2 | null {
    aim(x, y)
    plane.constant = -s.elevation
    return ray.ray.intersectPlane(plane, hit) ? [hit.x, -hit.z] : null
  }

  /** Nearest entity on the active floor under the screen point (objects carry userData.id / kind). */
  function pick(x: number, y: number): { id: string; kind: string } | null {
    const g = groups.get(floorState.activeId)
    if (!g) return null
    aim(x, y)
    ray.layers.mask = camera().layers.mask | (1 << LAYER.pick)
    for (const h of ray.intersectObject(g, true)) {
      if (h.instanceId !== undefined && h.object.userData.ids) return { id: h.object.userData.ids[h.instanceId], kind: h.object.userData.kind }
      for (let o: THREE.Object3D | null = h.object; o && o !== g; o = o.parent) if (o.userData.id) return { id: o.userData.id, kind: o.userData.kind }
    }
    return null
  }

  /** Screen pixels per metre at the working plane. */
  const ppm = () => (s.view === '2d' ? s.ppm : ppmFor(persp.position.distanceTo(orbit.target)))

  // ---------- floors ----------
  const groups = new Map<string, THREE.Group>()
  function floorGroup(id: string) {
    let g = groups.get(id)
    if (!g) {
      g = new THREE.Group()
      g.userData = { floorId: id, vis: 'hidden' as Vis }
      groups.set(id, g)
      floorsRoot.add(g)
    }
    return g
  }
  let floorState: { floors: { id: string; level: number; elevation: number }[]; activeId: string; mode: FloorVisibility } = {
    floors: [],
    activeId: '',
    mode: 'ghost'
  }
  function setFloors(floors: { id: string; level: number; elevation: number }[], activeId: string, mode: FloorVisibility) {
    floorState = { floors, activeId, mode }
    for (const [id, g] of groups) if (!floors.some(f => f.id === id)) (floorsRoot.remove(g), groups.delete(id))
    const active = floors.find(f => f.id === activeId)
    const elevationChanged = active && active.elevation !== s.elevation
    for (const f of floors) {
      const g = floorGroup(f.id)
      g.position.y = f.elevation
      const below = active ? f.level < active.level : false
      const above = active ? f.level > active.level : false
      g.userData.vis = (
        f.id === activeId ? 'normal'
        : mode === 'all' ? (above && s.view === '2d' ? 'hidden' : 'normal')
        : mode === 'ghost' && below && f.level === active!.level - 1 ? 'ghost'
        : 'hidden'
      ) satisfies Vis
    }
    if (active && elevationChanged) {
      const dy = active.elevation - s.elevation
      s.elevation = active.elevation
      persp.position.y += dy
      orbit.target.y += dy
      if (tween) (tween.to.pos.y += dy, tween.to.target.y += dy)
      updateOrtho()
    }
    requestRender()
  }

  const refloor = () => setFloors(floorState.floors, floorState.activeId, floorState.mode) // floors above hide in 2D

  function syncShadows() {
    sun.castShadow = s.view !== '2d'
  }

  function setTheme(dark: boolean) {
    renderer.setClearColor(dark ? BG.dark : BG.light)
    grid.setTheme(dark)
    requestRender()
  }

  // ---------- loop ----------
  const anims = new Set<(now: number) => boolean>()
  /** Run fn every frame until it returns false. */
  function animate(fn: (now: number) => boolean) {
    anims.add(fn)
    requestRender()
  }
  let pending = false
  function requestRender() {
    if (pending) return
    pending = true
    requestAnimationFrame(frame)
  }

  function frame(now: number) {
    pending = false
    if (tween) {
      const k = ease(Math.min(1, (now - tween.t0) / TWEEN_MS))
      persp.position.lerpVectors(tween.from.pos, tween.to.pos, k)
      orbit.target.lerpVectors(tween.from.target, tween.to.target, k)
      persp.lookAt(orbit.target)
      if (k === 1) {
        const done = tween.done
        tween = null
        done?.()
      }
      requestRender()
    } else if (s.view === '3d' && orbit.update()) requestRender() // damping still settling
    for (const fn of anims) if (!fn(now)) anims.delete(fn)
    if (anims.size) requestRender()

    const cam = camera()
    grid.update(s.elevation)
    overlay.position.y = s.elevation + 0.02
    overlay.visible = !walking() && !exporting
    labels.domElement.style.display = walking() ? 'none' : ''
    const all = [...groups.values()]
    const ghosts = all.some(g => g.userData.vis === 'ghost')
    renderer.shadowMap.needsUpdate = true
    if (ghosts) {
      for (const g of all) g.visible = g.userData.vis === 'ghost'
      grid.object.visible = overlay.visible = false
      scene.overrideMaterial = ghostMat
      renderer.render(scene, cam)
      scene.overrideMaterial = null
      grid.object.visible = true
      overlay.visible = !walking() && !exporting
    }
    for (const g of all) g.visible = g.userData.vis === 'normal'
    renderer.autoClear = !ghosts // draw over the ghost pass
    renderer.render(scene, cam)
    renderer.autoClear = true
    labels.render(scene, cam)
  }

  // ---------- export ----------

  /** PNG of the current view at `scale` × the screen resolution; overlay, gizmo and labels are left out. */
  async function snapshot(scale: number): Promise<Uint8Array> {
    const extras = scene.children.filter(o => o.userData.noExport && o.visible)
    extras.forEach(o => (o.visible = false))
    const pr = renderer.getPixelRatio()
    exporting = true
    try {
      renderer.setPixelRatio(pr * scale)
      renderer.setSize(s.w, s.h, false)
      frame(performance.now())
      // toBlob copies the drawing buffer synchronously, before the browser can clear it
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('The image is too large for this graphics card; try a smaller scale')
      return new Uint8Array(await blob.arrayBuffer())
    } finally {
      exporting = false
      extras.forEach(o => (o.visible = true))
      renderer.setPixelRatio(pr)
      renderer.setSize(s.w, s.h, false)
      requestRender()
    }
  }

  /**
   * Iso thumbnail of the whole building (all floors), JPEG bytes, or null for an empty project.
   * Synchronous: rendered and copied in one task, so the screen never shows it.
   */
  function thumbnail(w = 320, h = 200): Uint8Array | null {
    const box = new THREE.Box3()
    for (const g of groups.values()) box.expandByObject(g)
    if (box.isEmpty()) return null
    const saved = [...groups.values()].map(g => [g, g.visible] as const)
    const hidden = [overlay, grid.object, ...scene.children.filter(o => o.userData.noExport)].map(o => [o, o.visible] as const)
    for (const [g] of saved) g.visible = true
    for (const [o] of hidden) o.visible = false
    const cam = new THREE.PerspectiveCamera(35, s.w / s.h, 0.1, 2000)
    cam.layers.enable(LAYER.model)
    const center = box.getCenter(new THREE.Vector3())
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1)
    cam.position.copy(center).add(new THREE.Vector3(1, 0.9, 1.2).normalize().multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(15))))
    cam.lookAt(center)
    renderer.shadowMap.needsUpdate = true
    renderer.render(scene, cam)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    // crop the middle of the canvas to the thumbnail's aspect
    const [cw, ch] = [canvas.width, canvas.height]
    const sw = Math.min(cw, (ch * w) / h)
    const sh = (sw * h) / w
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#f4f4f5'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(canvas, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, w, h)
    for (const [o, v] of [...saved, ...hidden]) o.visible = v
    requestRender()
    const b64 = out.toDataURL('image/jpeg', 0.82).split(',')[1]
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  }

  /** Binary glTF of the whole building or the active floor: model geometry only (no plan symbols, pick boxes, labels). */
  async function exportGlb(activeOnly: boolean): Promise<Uint8Array> {
    const target = activeOnly ? groups.get(floorState.activeId) : floorsRoot
    if (!target) throw new Error('Nothing to export')
    const restore: [THREE.Object3D, boolean][] = []
    const set = (o: THREE.Object3D, v: boolean) => (restore.push([o, o.visible]), (o.visible = v))
    for (const g of groups.values()) set(g, true)
    const skip = (1 << LAYER.plan) | (1 << LAYER.pick) | (1 << LAYER.ceiling)
    target.traverse(o => {
      if (o instanceof CSS2DObject || (o as THREE.Line).isLine || (o.layers.mask & skip && !(o.layers.mask & 1))) set(o, false)
    })
    try {
      const out = await new GLTFExporter().parseAsync(target, { binary: true, onlyVisible: true })
      return new Uint8Array(out as ArrayBuffer)
    } finally {
      for (const [o, v] of restore.reverse()) o.visible = v
      requestRender()
    }
  }

  const resize = new ResizeObserver(() => {
    s.w = Math.max(1, el.clientWidth)
    s.h = Math.max(1, el.clientHeight)
    renderer.setSize(s.w, s.h)
    labels.setSize(s.w, s.h)
    persp.aspect = s.w / s.h
    persp.updateProjectionMatrix()
    updateOrtho()
    requestRender()
  })
  resize.observe(el)
  // Warm up shaders so the first on-demand frames aren't drawn before the grid program is ready.
  renderer.compileAsync(scene, persp).then(requestRender)

  return {
    scene,
    get camera() {
      return camera()
    },
    overlay,
    floorGroup,
    requestRender,
    setView,
    get view() {
      return s.view
    },
    preset,
    pan,
    setSpace,
    setFloors,
    setTheme,
    planAt,
    pick,
    ppm,
    animate,
    labelsEl: labels.domElement,
    perspCamera: persp,
    canvas,
    setGuard: (fn: (() => boolean) | null) => (guard = fn),
    snapshot,
    exportGlb,
    thumbnail,
    size: (v: THREE.Vector2) => v.set(s.w, s.h),
    get activeFloorId() {
      return floorState.activeId
    },
    dispose() {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true })
      resize.disconnect()
      orbit.dispose()
      renderer.dispose()
      el.replaceChildren()
    }
  }
}

export type Viewport = ReturnType<typeof createViewport>
