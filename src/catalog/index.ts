// Catalog registry: lookup, search, model factory (procedural or GLB, cached), thumbnails.
import * as THREE from 'three'
import { reactive } from 'vue'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CATALOG, type CatalogItem } from './manifest'
import { buildProcedural } from './procedural'

export { CATALOG, CATEGORIES, type CatalogItem, type Category } from './manifest'

const byId = new Map(CATALOG.map(i => [i.id, i]))
export const catalogItem = (id: string) => byId.get(id)

/** Bumps when an async model (GLB) finishes loading, so the scene rebuilds items that use it. */
export const catalogState = reactive({ version: 0 })

export function search(q: string, list: CatalogItem[] = CATALOG) {
  const s = q.trim().toLowerCase()
  if (!s) return list
  return list.filter(i => i.name.toLowerCase().includes(s) || i.tags.some(t => t.includes(s)) || i.category.includes(s))
}

export function variantOf(item: CatalogItem, variant: string | null) {
  return item.variants?.find(v => v.id === variant) ?? item.variants?.[0] ?? null
}

// ---------- models ----------

const glbCache = new Map<string, THREE.Object3D | 'loading' | 'failed'>()
const loader = new GLTFLoader()

/** A GLB scaled to fit `size` (w × d × h), centred on the footprint, standing on y = 0. */
function fitted(src: THREE.Object3D, [w, d, h]: [number, number, number]) {
  const obj = src.clone(true)
  const box = new THREE.Box3().setFromObject(obj)
  const dim = box.getSize(new THREE.Vector3())
  obj.scale.set(w / (dim.x || 1), h / (dim.y || 1), d / (dim.z || 1))
  const b2 = new THREE.Box3().setFromObject(obj)
  const c = b2.getCenter(new THREE.Vector3())
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z))
  const g = new THREE.Group()
  g.add(obj)
  return g
}

/** Build an item's model in local space (front = +z). GLBs show a placeholder box until loaded. */
export function buildModel(item: CatalogItem, variant: string | null): THREE.Group {
  if (item.model.type === 'procedural') return buildProcedural(item.model.builder, item.size, variantOf(item, variant)?.colors ?? {}, item.model.params)
  const url = item.model.url
  const cached = glbCache.get(url)
  if (cached && cached !== 'loading' && cached !== 'failed') return fitted(cached, item.size)
  if (!cached) {
    glbCache.set(url, 'loading')
    loader.load(
      url,
      gltf => {
        glbCache.set(url, gltf.scene)
        catalogState.version++
      },
      undefined,
      err => {
        console.warn(`Catalog model ${url} failed to load`, err)
        glbCache.set(url, 'failed')
      }
    )
  }
  return buildProcedural('placeholder', item.size, {})
}

// ---------- thumbnails ----------

let thumbRenderer: THREE.WebGLRenderer | null = null
const thumbs = new Map<string, string>()
const THUMB = 128

/** 128 px iso render of an item, cached (data URL). Re-rendered once its GLB arrives. */
export function thumbnail(item: CatalogItem): string {
  const key = `${item.id}:${catalogState.version}`
  const hit = thumbs.get(key)
  if (hit) return hit
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    thumbRenderer.setSize(THUMB, THUMB)
  }
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(2, 4, 3)
  scene.add(sun)
  const model = buildModel(item, null)
  scene.add(model)
  const [w, d, h] = item.size
  const r = Math.max(Math.hypot(w, d, h) / 2, 0.2)
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100)
  const center = new THREE.Vector3(0, h / 2, 0)
  cam.position.copy(center).add(new THREE.Vector3(1, 0.8, 1.3).normalize().multiplyScalar(r / Math.sin((15 * Math.PI) / 180)))
  cam.lookAt(center)
  thumbRenderer.render(scene, cam)
  const url = thumbRenderer.domElement.toDataURL()
  model.traverse(o => (o as THREE.Mesh).geometry?.dispose())
  thumbs.set(key, url)
  return url
}

/** Plan footprint of a placed item (rotated, scaled rectangle), CCW. */
export function itemFootprint(it: { catalogId: string; x: number; y: number; rotation: number; scale: [number, number, number] }): [number, number][] {
  const def = catalogItem(it.catalogId)
  const s = it.scale[0] || 1
  const [w, d] = def ? [def.size[0] * s, def.size[1] * s] : [0.5, 0.5]
  const r = (it.rotation * Math.PI) / 180
  const [c, sn] = [Math.cos(r), Math.sin(r)]
  return ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as [number, number][]).map(([x, y]) => [x * c - y * sn + it.x, x * sn + y * c + it.y])
}
