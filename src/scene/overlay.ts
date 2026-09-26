// Screen-space helpers drawn over the active floor: tool previews, selection/hover outlines, handles,
// snap guides, labels, and the snap pulse. Rebuilt wholesale on every set() — they are few.
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { Vec2 } from '@/types'
import type { Viewport } from './viewport'
import { dispose } from './builders'

export type Shape =
  | { kind: 'line'; points: Vec2[]; closed?: boolean; color: string; width?: number; dashed?: boolean }
  | { kind: 'fill'; points: Vec2[]; color: string; opacity?: number }
  | { kind: 'dots'; points: Vec2[]; color: string; size?: number }
  | { kind: 'label'; at: Vec2; text: string; tone?: 'default' | 'error' }

export const COLORS = { primary: '#10b981', hover: '#34d399', guide: '#f59e0b', error: '#ef4444', draw: '#0ea5e9' }

const v3 = (p: Vec2, y = 0) => new THREE.Vector3(p[0], y, -p[1])

export function createOverlay(vp: Viewport) {
  const root = new THREE.Group()
  root.renderOrder = 10
  vp.overlay.add(root)
  const size = new THREE.Vector2()

  function onTop<T extends THREE.Object3D>(o: T): T {
    o.renderOrder = 10
    return o
  }

  function set(shapes: Shape[]) {
    for (const c of [...root.children]) {
      c.traverse(o => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.())
      dispose(c)
    }
    vp.size(size)
    for (const s of shapes) {
      if (s.kind === 'line' && s.points.length > 1) {
        const pts = s.closed ? [...s.points, s.points[0]] : s.points
        const geo = new LineGeometry().setPositions(pts.flatMap(p => [p[0], 0, -p[1]]))
        const m = new LineMaterial({ color: s.color, linewidth: s.width ?? 2, dashed: !!s.dashed, dashSize: 0.15, gapSize: 0.1, depthTest: false, transparent: true })
        m.resolution.copy(size)
        const line = new Line2(geo, m)
        if (s.dashed) line.computeLineDistances()
        root.add(onTop(line))
      } else if (s.kind === 'fill' && s.points.length > 2) {
        const geo = new THREE.ShapeGeometry(new THREE.Shape(s.points.map(p => new THREE.Vector2(p[0], p[1])))).rotateX(-Math.PI / 2)
        const m = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.opacity ?? 0.15, depthTest: false, side: THREE.DoubleSide })
        root.add(onTop(new THREE.Mesh(geo, m)))
      } else if (s.kind === 'dots' && s.points.length) {
        const geo = new THREE.BufferGeometry().setFromPoints(s.points.map(p => v3(p)))
        const m = new THREE.PointsMaterial({ color: s.color, size: s.size ?? 9, sizeAttenuation: false, depthTest: false })
        root.add(onTop(new THREE.Points(geo, m)))
      } else if (s.kind === 'label') {
        const el = document.createElement('div')
        el.className = `ov-label${s.tone === 'error' ? ' ov-error' : ''}`
        el.textContent = s.text
        const tag = new CSS2DObject(el)
        tag.position.copy(v3(s.at))
        root.add(tag)
      }
    }
    vp.requestRender()
  }

  /** Expanding ring at a snap point — the little "click" of snapping. */
  function pulse(p: Vec2) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 32; i++) pts.push(new THREE.Vector3(Math.cos((i / 32) * Math.PI * 2), 0, Math.sin((i / 32) * Math.PI * 2)))
    const ring = onTop(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COLORS.guide, transparent: true, depthTest: false })))
    ring.position.copy(v3(p))
    vp.overlay.add(ring)
    const t0 = performance.now()
    const r0 = 4 / vp.ppm()
    vp.animate(now => {
      const k = Math.min(1, (now - t0) / 300)
      ring.scale.setScalar(r0 + (14 / vp.ppm()) * k)
      ;(ring.material as THREE.LineBasicMaterial).opacity = 1 - k
      if (k === 1) dispose(ring)
      return k < 1
    })
  }

  return { set, pulse }
}

export type Overlay = ReturnType<typeof createOverlay>
