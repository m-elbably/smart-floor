// Procedural furniture from boxes, cylinders and spheres. Local frame (three.js): origin at the
// footprint centre on the floor, width along x, depth along z with the FRONT facing +z, height along y.
import * as THREE from 'three'

type Size = { w: number; d: number; h: number }
type Colors = Record<string, string>
type Builder = (s: Size, c: Colors, p: Record<string, unknown>) => THREE.Group

const mats = new Map<string, THREE.Material>()
function m(color: string, opts: { opacity?: number; rough?: number; metal?: number } = {}) {
  const key = `${color}${opts.opacity ?? 1}${opts.rough ?? 0.8}${opts.metal ?? 0}`
  let mat = mats.get(key)
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.8,
      metalness: opts.metal ?? 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1
    })
    mats.set(key, mat)
  }
  return mat
}

/** Box by extents: x/z centre, y from its bottom. Optional rotation in radians. */
function box(
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? m(color) : color)
  mesh.position.set(x, y + h / 2, z)
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz)
  g.add(mesh)
  return mesh
}

function cyl(
  g: THREE.Group,
  rTop: number,
  rBot: number,
  h: number,
  color: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  seg = 20,
  rx = 0,
  ry = 0,
  rz = 0
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), typeof color === 'string' ? m(color) : color)
  mesh.position.set(x, y + h / 2, z)
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz)
  g.add(mesh)
  return mesh
}

function ball(g: THREE.Group, r: number, color: string, x = 0, y = 0, z = 0, sy = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m(color))
  mesh.position.set(x, y, z)
  mesh.scale.y = sy
  g.add(mesh)
  return mesh
}

function legs(g: THREE.Group, s: Size, h: number, color: string, inset = 0.05, r = 0.025) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      cyl(g, r * 0.85, r, h, color, sx * (s.w / 2 - inset), 0, sz * (s.d / 2 - inset), 8)
}

// ---------- natural shapes ----------

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const hash = (x: number, y: number, z: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return v - Math.floor(v)
}

function flat(color: string) {
  const key = `flat${color}`
  let mat = mats.get(key)
  if (!mat) mats.set(key, (mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })))
  return mat
}

function frondMat(color: string) {
  const key = `frond${color}`
  let mat = mats.get(key)
  if (!mat) mats.set(key, (mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, flatShading: true, roughness: 0.9 })))
  return mat
}

const shade = (color: string, dh: number, dl: number) => new THREE.Color(color).offsetHSL(dh, 0, dl).getStyle()

function clump(g: THREE.Group, r: number, color: string, x: number, y: number, z: number, seed: number, sy = 1, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(r, detail)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const [vx, vy, vz] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
    const k = 0.78 + 0.44 * hash(Math.round(vx * 997) + seed, Math.round(vy * 997), Math.round(vz * 997))
    pos.setXYZ(i, vx * k, vy * k, vz * k)
  }
  geo.computeVertexNormals()
  const base = new THREE.Color(color)
  const colors: number[] = []
  for (let f = 0; f < pos.count / 3; f++) {
    const h = hash(f + seed, seed * 0.37, f * 0.11)
    const c = base.clone().offsetHSL((h - 0.5) * 0.03, 0, (h - 0.5) * 0.12)
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(geo, leafMat())
  mesh.position.set(x, y, z)
  mesh.scale.y = sy
  g.add(mesh)
  return mesh
}

let leaves: THREE.Material | null = null
const leafMat = () => (leaves ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }))

function limb(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: string) {
  const len = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), flat(color))
  mesh.position.copy(a).lerp(b, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.add(mesh)
  return mesh
}

const B: Record<string, Builder> = {
  sofa(s, c, p) {
    const g = new THREE.Group()
    const arm = Math.min(0.18, s.w * 0.12)
    const seatH = s.h * 0.48
    const legH = 0.08
    legs(g, s, legH, c.legs ?? '#3f3f46', 0.06, 0.02)
    const baseColor = c.fabric ?? '#8e9196'
    const cushionColor = m(baseColor, { rough: 0.95 })

    if (p.sectional) {
      // L-shaped sectional sofa with corner chaise
      const chaiseW = Math.max(0.85, s.w * 0.38)
      const mainW = s.w - chaiseW
      const sofaD = s.d * 0.52
      const backD = sofaD * 0.28
      // Main sofa base & back
      box(g, mainW, seatH - legH, sofaD, baseColor, -s.w / 2 + mainW / 2, legH, -s.d / 2 + sofaD / 2)
      box(g, mainW - arm, s.h - seatH, backD, baseColor, -s.w / 2 + arm + (mainW - arm) / 2, seatH, -s.d / 2 + backD / 2)
      // Left armrest
      box(g, arm, s.h * 0.72 - legH, sofaD, baseColor, -s.w / 2 + arm / 2, legH, -s.d / 2 + sofaD / 2)
      // Main cushions
      const seats = Math.max(1, Math.round((mainW - arm) / 0.65))
      const cw = (mainW - arm) / seats
      for (let i = 0; i < seats; i++) {
        box(g, cw - 0.02, 0.1, sofaD * 0.72, cushionColor, -s.w / 2 + arm + cw * (i + 0.5), seatH, -s.d / 2 + backD + sofaD * 0.36)
        box(g, cw - 0.03, s.h - seatH - 0.06, 0.12, cushionColor, -s.w / 2 + arm + cw * (i + 0.5), seatH + 0.04, -s.d / 2 + backD * 0.6)
      }
      // Chaise section extending forward
      box(g, chaiseW, seatH - legH, s.d, baseColor, s.w / 2 - chaiseW / 2, legH, 0)
      box(g, chaiseW - arm, s.h - seatH, backD, baseColor, s.w / 2 - chaiseW / 2 - arm / 2, seatH, -s.d / 2 + backD / 2)
      // Right armrest
      box(g, arm, s.h * 0.72 - legH, s.d, baseColor, s.w / 2 - arm / 2, legH, 0)
      // Chaise cushion
      box(g, chaiseW - arm - 0.02, 0.1, s.d - backD - 0.04, cushionColor, s.w / 2 - chaiseW / 2 - arm / 2, seatH, backD / 2)
      box(g, chaiseW - arm - 0.04, s.h - seatH - 0.06, 0.12, cushionColor, s.w / 2 - chaiseW / 2 - arm / 2, seatH + 0.04, -s.d / 2 + backD * 0.6)
      // Throw pillows
      const accent = shade(baseColor, 0.05, 0.15)
      box(g, 0.32, 0.32, 0.08, accent, -s.w / 2 + arm + 0.18, seatH + 0.06, -s.d / 2 + backD + 0.12, 0.1, 0.3, 0)
      box(g, 0.3, 0.3, 0.08, accent, s.w / 2 - arm - 0.18, seatH + 0.06, s.d / 2 - 0.22, 0.1, -0.4, 0)
      return g
    }

    if (p.chaise) {
      // Daybed / Chaise lounge
      box(g, s.w, seatH - legH, s.d, baseColor, 0, legH, 0)
      box(g, s.w - 0.04, 0.1, s.d - 0.04, cushionColor, 0, seatH, 0)
      box(g, 0.18, s.h - seatH, s.d, baseColor, -s.w / 2 + 0.09, seatH, 0)
      cyl(g, 0.1, 0.1, s.d * 0.85, baseColor, -s.w / 2 + 0.25, seatH + 0.1, 0, 16, Math.PI / 2, 0, 0)
      return g
    }

    // Standard sofa / armchair
    box(g, s.w, seatH - legH, s.d, baseColor, 0, legH, 0)
    box(g, s.w - 2 * arm, s.h - seatH, s.d * 0.25, baseColor, 0, seatH, -s.d / 2 + s.d * 0.125)
    for (const sx of [-1, 1]) {
      box(g, arm, s.h * 0.72 - legH, s.d, baseColor, sx * (s.w / 2 - arm / 2), legH, 0)
      box(g, arm + 0.02, 0.025, s.d + 0.01, c.legs ?? '#3f3f46', sx * (s.w / 2 - arm / 2), s.h * 0.72 - 0.01, 0)
    }
    const seats = Math.max(1, Math.round((s.w - 2 * arm) / 0.65))
    const cw = (s.w - 2 * arm) / seats
    for (let i = 0; i < seats; i++) {
      const cx = -s.w / 2 + arm + cw * (i + 0.5)
      box(g, cw - 0.02, 0.11, s.d * 0.72, cushionColor, cx, seatH, s.d * 0.12)
      box(g, cw - 0.03, s.h - seatH - 0.05, 0.13, cushionColor, cx, seatH + 0.04, -s.d / 2 + s.d * 0.22, -0.08, 0, 0)
    }
    if (seats >= 2 && p.pillows !== false) {
      const accent = shade(baseColor, 0.06, 0.12)
      box(g, 0.32, 0.32, 0.08, accent, -s.w / 2 + arm + 0.16, seatH + 0.05, -s.d / 2 + s.d * 0.32, 0.05, 0.35, 0)
      box(g, 0.32, 0.32, 0.08, accent, s.w / 2 - arm - 0.16, seatH + 0.05, -s.d / 2 + s.d * 0.32, 0.05, -0.35, 0)
    }
    return g
  },

  table(s, c, p) {
    const g = new THREE.Group()
    const topT = 0.04
    const topColor = c.top ?? c.wood ?? '#b8915f'
    const legColor = c.legs ?? c.wood ?? '#9c7a4f'

    if (p.shape === 'round') {
      // Circular table
      cyl(g, s.w / 2, s.w / 2, topT, topColor, 0, s.h - topT, 0, 32)
      // Flared central pedestal base
      cyl(g, 0.06, 0.08, s.h - topT - 0.03, legColor, 0, 0.03, 0, 16)
      cyl(g, s.w * 0.3, s.w * 0.33, 0.03, legColor, 0, 0, 0, 24)
      const n = Number(p.chairs ?? 0)
      if (n) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          const ch = B.chair({ w: 0.42, d: 0.44, h: 0.85 }, c, {})
          ch.position.set(Math.sin(a) * (s.w * 0.44), 0, Math.cos(a) * (s.d * 0.44))
          ch.rotation.y = a + Math.PI
          g.add(ch)
        }
      }
      return g
    }

    if (p.island) {
      // Kitchen island with waterfall countertop overhang and bar stools
      box(g, s.w, topT + 0.01, s.d, topColor, 0, s.h - topT - 0.01, 0)
      // Waterfall ends
      box(g, topT, s.h - topT, s.d, topColor, -s.w / 2 + topT / 2, 0, 0)
      box(g, topT, s.h - topT, s.d, topColor, s.w / 2 - topT / 2, 0, 0)
      // Cabinet base in rear half
      const cabD = s.d * 0.55
      const cabH = s.h - topT - 0.08
      box(g, s.w - 2 * topT - 0.02, cabH, cabD, c.wood ?? '#34465e', 0, 0.08, -s.d / 2 + cabD / 2 + topT / 2)
      box(g, s.w - 2 * topT - 0.04, 0.08, cabD - 0.04, '#27272a', 0, 0, -s.d / 2 + cabD / 2 + topT / 2)
      // Bar stools tucked under the front breakfast bar overhang
      for (const sx of [-s.w * 0.25, s.w * 0.25]) {
        const stool = B.chair({ w: 0.42, d: 0.42, h: 0.92 }, c, { kind: 'barstool' })
        stool.position.set(sx, 0, s.d * 0.26)
        g.add(stool)
      }
      return g
    }

    if (p.coffee) {
      // Coffee table with lower shelf and styled top tray
      box(g, s.w, topT, s.d, topColor, 0, s.h - topT, 0)
      box(g, s.w - 0.08, 0.02, s.d - 0.08, legColor, 0, 0.1, 0)
      legs(g, s, s.h - topT, legColor, 0.05, 0.025)
      // Styled tray and book stack on top
      box(g, s.w * 0.32, 0.02, s.d * 0.45, '#27272a', -s.w * 0.18, s.h, 0)
      box(g, 0.2, 0.03, 0.26, '#c9ccd1', s.w * 0.2, s.h, 0.04)
      return g
    }

    if (p.side) {
      // Round/square accent side table
      cyl(g, s.w / 2, s.w / 2, topT, topColor, 0, s.h - topT, 0, 24)
      cyl(g, 0.015, 0.015, s.h - topT - 0.02, legColor, 0, 0.02, 0, 8)
      cyl(g, s.w * 0.35, s.w * 0.38, 0.02, legColor, 0, 0, 0, 20)
      return g
    }

    if (p.console) {
      // Entryway / living console table with 2 drawers and bottom shelf
      box(g, s.w, topT, s.d, topColor, 0, s.h - topT, 0)
      box(g, s.w - 0.04, 0.12, s.d - 0.04, c.wood ?? topColor, 0, s.h - topT - 0.12, 0)
      box(g, s.w - 0.08, 0.02, s.d - 0.08, legColor, 0, 0.12, 0)
      legs(g, s, s.h - topT - 0.12, legColor, 0.04, 0.02)
      for (const sx of [-s.w * 0.24, s.w * 0.24]) {
        cyl(g, 0.015, 0.015, 0.02, '#eab308', sx, s.h - topT - 0.06, s.d / 2 + 0.01, 8, Math.PI / 2, 0, 0)
      }
      return g
    }

    if (p.desk) {
      // Executive desk with modesty panel, dual drawer pedestals, and monitor
      box(g, s.w, topT, s.d, topColor, 0, s.h - topT, 0)
      const pedW = s.w * 0.26
      const pedH = s.h - topT - 0.05
      // Left and right drawer pedestals
      for (const sx of [-s.w / 2 + pedW / 2 + 0.04, s.w / 2 - pedW / 2 - 0.04]) {
        box(g, pedW, pedH, s.d - 0.06, c.wood ?? topColor, sx, 0.05, 0)
        box(g, pedW - 0.02, 0.05, s.d - 0.08, '#27272a', sx, 0, 0)
        // 3 drawer handles
        for (let i = 0; i < 3; i++) {
          box(g, 0.12, 0.015, 0.02, '#c9ccd1', sx, 0.1 + i * (pedH / 3), s.d / 2 - 0.01)
        }
      }
      // Modesty panel
      box(g, s.w - 2 * pedW - 0.12, pedH * 0.7, 0.02, c.wood ?? topColor, 0, 0.18, -s.d / 2 + 0.06)
      // Desktop accessories: desk mat, laptop, keyboard
      box(g, s.w * 0.44, 0.005, s.d * 0.45, '#27272a', 0, s.h, 0.06)
      // Open laptop
      box(g, 0.34, 0.012, 0.23, '#c9ccd1', 0, s.h + 0.005, 0.04)
      box(g, 0.34, 0.22, 0.008, '#18181b', 0, s.h + 0.015, -0.07, -0.25, 0, 0)
      return g
    }

    if (p.meeting) {
      // Conference room meeting table with 6 conference chairs
      box(g, s.w, topT, s.d, topColor, 0, s.h - topT, 0)
      box(g, 0.6, 0.004, 0.16, '#c9ccd1', 0, s.h, 0) // Cable box
      // 2 heavy trestle legs
      for (const sx of [-s.w * 0.32, s.w * 0.32]) {
        box(g, 0.08, s.h - topT, s.d * 0.65, legColor, sx, 0, 0)
      }
      // 6 conference chairs
      for (let i = 0; i < 3; i++) {
        const x = -s.w / 2 + (s.w / 3) * (i + 0.5)
        for (const side of [-1, 1]) {
          const ch = B.officeChair({ w: 0.55, d: 0.55, h: 0.95 }, c, {})
          ch.position.set(x, 0, side * (s.d / 2 + 0.18))
          ch.rotation.y = side > 0 ? Math.PI : 0
          g.add(ch)
        }
      }
      return g
    }

    // Standard rectangular table
    box(g, s.w, topT, s.d, topColor, 0, s.h - topT, 0)
    legs(g, s, s.h - topT, legColor, 0.06, 0.03)
    if (p.drawer) box(g, s.w * 0.35, 0.14, s.d * 0.85, c.wood ?? topColor, s.w * 0.28, s.h - topT - 0.14, 0)
    const n = Number(p.chairs ?? 0)
    if (n) {
      const per = Math.floor(n / 2)
      for (let i = 0; i < per; i++) {
        for (const side of [-1, 1]) {
          const ch = B.chair({ w: 0.44, d: 0.48, h: 0.88 }, c, {})
          ch.position.set(-s.w / 2 + (s.w / per) * (i + 0.5), 0, side * (s.d / 2 + 0.12))
          ch.rotation.y = side > 0 ? Math.PI : 0
          g.add(ch)
        }
      }
    }
    return g
  },

  chair(s, c, p) {
    const g = new THREE.Group()
    const woodColor = c.wood ?? c.legs ?? '#b8915f'
    const fabricColor = c.fabric ?? '#8e9196'

    if (p.kind === 'armchair') {
      const arm = 0.12
      const seatH = 0.45
      legs(g, s, 0.1, c.legs ?? '#3f3f46', 0.06, 0.02)
      box(g, s.w, seatH - 0.1, s.d, fabricColor, 0, 0.1, 0)
      box(g, s.w - 2 * arm, s.h - seatH, 0.18, fabricColor, 0, seatH, -s.d / 2 + 0.09)
      for (const sx of [-1, 1]) box(g, arm, s.h * 0.7 - 0.1, s.d, fabricColor, sx * (s.w / 2 - arm / 2), 0.1, 0)
      box(g, s.w - 2 * arm - 0.02, 0.1, s.d * 0.7, m(fabricColor, { rough: 0.95 }), 0, seatH, 0.05)
      box(g, 0.3, 0.3, 0.08, shade(fabricColor, 0.05, 0.15), 0, seatH + 0.06, -s.d / 2 + 0.22, 0.1, 0, 0)
      return g
    }

    if (p.kind === 'barstool') {
      const seatH = 0.72
      // 4 tall tapered metal legs
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cyl(g, 0.014, 0.018, seatH, '#27272a', sx * (s.w / 2 - 0.06), 0, sz * (s.d / 2 - 0.06), 8)
      // Footrest ring
      box(g, s.w - 0.08, 0.02, s.d - 0.08, '#27272a', 0, 0.25, 0)
      // Upholstered seat
      cyl(g, s.w * 0.44, s.w * 0.42, 0.08, fabricColor, 0, seatH, 0, 20)
      // Low curved backrest
      box(g, s.w * 0.65, s.h - seatH - 0.08, 0.05, fabricColor, 0, seatH + 0.08, -s.d / 2 + 0.06)
      return g
    }

    const seat = 0.46
    legs(g, s, seat - 0.04, woodColor, 0.04, 0.018)
    box(g, s.w, 0.04, s.d, woodColor, 0, seat - 0.04, 0)
    // Padded seat cushion
    box(g, s.w - 0.04, 0.03, s.d - 0.04, fabricColor, 0, seat, 0.01)
    // Backrest slats
    box(g, s.w, s.h - seat, 0.03, woodColor, 0, seat, -s.d / 2 + 0.03)
    return g
  },

  officeChair(s, c) {
    const g = new THREE.Group()
    // 5-star base with caster wheels
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const lx = (Math.sin(a) * s.w) / 4
      const lz = (Math.cos(a) * s.w) / 4
      const leg = box(g, 0.04, 0.035, s.w / 2, '#27272a', lx, 0.04, lz)
      leg.rotation.y = a
      // Caster wheel
      cyl(g, 0.025, 0.025, 0.02, '#18181b', Math.sin(a) * (s.w / 2 - 0.04), 0, Math.cos(a) * (s.w / 2 - 0.04), 8, Math.PI / 2, 0, 0)
    }
    // Pneumatic cylinder
    cyl(g, 0.032, 0.035, 0.38, '#71717a', 0, 0.08, 0, 12)
    // Seat mechanism
    box(g, 0.2, 0.04, 0.2, '#18181b', 0, 0.42, 0)
    // Contoured seat cushion
    box(g, s.w * 0.85, 0.08, s.d * 0.8, c.fabric ?? '#4f6d8f', 0, 0.46, 0.02)
    // Ergonomic backrest with lumbar curve
    box(g, s.w * 0.78, s.h - 0.58, 0.06, c.fabric ?? '#4f6d8f', 0, 0.58, -s.d / 2 + 0.08, -0.06, 0, 0)
    // Headrest
    box(g, s.w * 0.45, 0.14, 0.06, c.fabric ?? '#4f6d8f', 0, s.h - 0.12, -s.d / 2 + 0.06)
    // T-shaped armrests
    for (const sx of [-1, 1]) {
      box(g, 0.03, 0.2, 0.04, '#27272a', sx * (s.w * 0.42), 0.5, 0)
      box(g, 0.08, 0.025, 0.24, '#18181b', sx * (s.w * 0.42), 0.7, 0)
    }
    return g
  },

  bed(s, c, p) {
    const g = new THREE.Group()
    const frameColor = c.frame ?? '#b8915f'
    const sheetColor = c.sheet ?? '#f3f1ec'
    const blanketColor = c.blanket ?? '#d9d4c7'

    if (p.bunk) {
      // Kids bunk bed with 4 corner posts, safety rails, and front ladder
      const postW = 0.06
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(g, postW, s.h, postW, frameColor, sx * (s.w / 2 - postW / 2), 0, sz * (s.d / 2 - postW / 2))
      // Lower bunk
      box(g, s.w, 0.16, s.d, frameColor, 0, 0.25, 0)
      box(g, s.w - 0.1, 0.14, s.d - 0.1, sheetColor, 0, 0.38, 0)
      box(g, s.w - 0.08, 0.04, s.d * 0.6, blanketColor, 0, 0.52, s.d * 0.18)
      box(g, s.w * 0.75, 0.1, 0.3, sheetColor, 0, 0.52, -s.d / 2 + 0.28)
      // Upper bunk
      box(g, s.w, 0.16, s.d, frameColor, 0, 1.15, 0)
      box(g, s.w - 0.1, 0.14, s.d - 0.1, sheetColor, 0, 1.28, 0)
      box(g, s.w - 0.08, 0.04, s.d * 0.6, blanketColor, 0, 1.42, s.d * 0.18)
      box(g, s.w * 0.75, 0.1, 0.3, sheetColor, 0, 1.42, -s.d / 2 + 0.28)
      // Safety guardrails for upper bunk
      box(g, s.w, 0.04, 0.03, frameColor, 0, 1.5, -s.d / 2 + postW / 2)
      box(g, s.w * 0.65, 0.04, 0.03, frameColor, -s.w * 0.17, 1.5, s.d / 2 - postW / 2)
      // Front ladder on right
      const ladX = s.w / 2 - 0.28
      box(g, 0.03, s.h * 0.9, 0.03, '#3f3f46', ladX - 0.16, 0, s.d / 2 + 0.02)
      box(g, 0.03, s.h * 0.9, 0.03, '#3f3f46', ladX + 0.16, 0, s.d / 2 + 0.02)
      for (let i = 1; i <= 5; i++) {
        box(g, 0.32, 0.025, 0.03, '#3f3f46', ladX, i * 0.28, s.d / 2 + 0.02)
      }
      return g
    }

    if (p.king) {
      // Luxury King Bed with tall tufted headboard, runner, and foot-of-bed bench
      box(g, s.w, 0.28, s.d - 0.45, frameColor, 0, 0.08, -0.22)
      legs(g, { ...s, d: s.d - 0.45 }, 0.08, frameColor, 0.08, 0.03)
      // Tall channel-tufted headboard
      box(g, s.w, s.h - 0.04, 0.12, frameColor, 0, 0.04, -s.d / 2 + 0.06)
      for (let i = 1; i <= 5; i++) {
        box(g, 0.01, s.h - 0.1, 0.01, '#3f3f46', -s.w / 2 + i * (s.w / 6), 0.08, -s.d / 2 + 0.12)
      }
      // Mattress & duvet
      box(g, s.w - 0.08, 0.26, s.d - 0.55, sheetColor, 0, 0.36, -0.2)
      box(g, s.w - 0.06, 0.06, (s.d - 0.55) * 0.65, blanketColor, 0, 0.62, 0.02)
      // Contrasting bed runner
      box(g, s.w - 0.04, 0.02, 0.45, shade(blanketColor, 0.04, -0.15), 0, 0.68, 0.15)
      // 4 sleeping pillows + 2 accent pillows
      for (let i = 0; i < 2; i++) {
        const x = -s.w * 0.26 + i * s.w * 0.52
        box(g, s.w * 0.38, 0.12, 0.38, sheetColor, x, 0.62, -s.d / 2 + 0.32, -0.1, 0, 0)
        box(g, s.w * 0.36, 0.11, 0.32, sheetColor, x, 0.68, -s.d / 2 + 0.48, -0.2, 0, 0)
        box(g, 0.3, 0.18, 0.12, shade(blanketColor, 0.05, -0.15), x, 0.72, -s.d / 2 + 0.62, -0.3, 0, 0)
      }
      // Padded foot-of-bed bench
      const bW = s.w * 0.82
      const bD = 0.38
      const bH = 0.45
      const bZ = s.d / 2 - bD / 2
      box(g, bW, 0.12, bD, frameColor, 0, bH - 0.12, bZ)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cyl(g, 0.02, 0.025, bH - 0.12, '#3f3f46', sx * (bW / 2 - 0.04), 0, bZ + sz * (bD / 2 - 0.04), 8)
      return g
    }

    // Standard bed
    box(g, s.w, 0.3, s.d, frameColor, 0, 0.05, 0)
    legs(g, s, 0.05, frameColor, 0.05, 0.03)
    box(g, s.w - 0.06, 0.22, s.d - 0.08, sheetColor, 0, 0.35, 0.02)
    box(g, s.w - 0.04, 0.05, s.d * 0.62, blanketColor, 0, 0.55, s.d * 0.19)
    box(g, s.w, s.h - 0.05, 0.08, frameColor, 0, 0.05, -s.d / 2 + 0.04)
    const pillows = s.w > 1.2 ? 2 : 1
    for (let i = 0; i < pillows; i++) {
      box(g, s.w / pillows - 0.12, 0.12, 0.35, sheetColor, -s.w / 2 + (s.w / pillows) * (i + 0.5), 0.57, -s.d / 2 + 0.3)
    }
    return g
  },

  cabinet(s, c, p) {
    if (p.mediaWall) {
      // Luxury acoustic slat media wall with mounted TV and floating console
      const g = new THREE.Group()
      // Acoustic vertical wood slat back panel
      box(g, s.w, s.h, 0.04, c.wood ?? '#6e4b32', 0, 0, -s.d / 2 + 0.02)
      const slatCount = Math.floor(s.w / 0.08)
      for (let i = 0; i < slatCount; i++) {
        box(g, 0.03, s.h, 0.02, c.top ?? '#b8915f', -s.w / 2 + (s.w / slatCount) * (i + 0.5), 0, -s.d / 2 + 0.05)
      }
      // Floating low console
      const consH = 0.32
      const consY = 0.38
      box(g, s.w * 0.92, consH, s.d - 0.08, '#1f1f22', 0, consY, 0)
      // 65" TV
      const tvW = Math.min(1.5, s.w * 0.72)
      const tvH = tvW * 0.58
      box(g, tvW, tvH, 0.03, '#111113', 0, consY + consH + 0.14, -s.d / 2 + 0.08)
      // Soundbar
      box(g, tvW * 0.7, 0.06, 0.08, '#27272a', 0, consY + consH + 0.04, -s.d / 2 + 0.1)
      // Top floating display shelf
      box(g, s.w * 0.85, 0.04, 0.18, c.wood ?? '#6e4b32', 0, s.h - 0.25, -s.d / 2 + 0.12)
      cyl(g, 0.04, 0.06, 0.14, '#f7f7f5', -s.w * 0.25, s.h - 0.21, -s.d / 2 + 0.12)
      return g
    }

    if (p.tv) {
      const g = B.cabinet({ ...s, h: 0.48 }, c, { ...p, tv: false })
      box(g, s.w * 0.36, 0.03, 0.2, '#27272a', 0, 0.48, -0.05)
      const sw = Math.min(s.w * 0.75, ((s.h - 0.54) / 0.56) * 1)
      box(g, sw, s.h - 0.54, 0.04, m('#111113', { rough: 0.3 }), 0, 0.51, -0.05)
      box(g, sw * 0.75, 0.05, 0.07, '#27272a', 0, 0.485, -0.02)
      return g
    }

    if (p.wallCabinets) {
      // Hanging upper kitchen cabinets with under-cabinet LED light strip
      const g = new THREE.Group()
      box(g, s.w, s.h, s.d, c.wood ?? '#f1f0ec', 0, 0, 0)
      const doors = 4
      for (let i = 0; i < doors; i++) {
        box(g, 0.006, s.h - 0.02, 0.005, '#52525b', -s.w / 2 + (s.w / doors) * i, 0.01, s.d / 2 + 0.002)
      }
      box(g, s.w - 0.1, 0.01, 0.04, '#fef08a', 0, 0, 0) // Warm LED strip
      return g
    }

    if (p.doubleVanity) {
      // Double washbasin bathroom vanity with twin sinks and splashback
      const g = new THREE.Group()
      const topT = 0.05
      const plinth = 0.08
      box(g, s.w, s.h - topT - plinth, s.d, c.wood ?? '#b8915f', 0, plinth, 0)
      box(g, s.w - 0.04, plinth, s.d - 0.06, '#27272a', 0, 0, -0.03)
      box(g, s.w + 0.02, topT, s.d + 0.02, c.top ?? '#f7f7f5', 0, s.h - topT, 0.01)
      // Marble splashback
      box(g, s.w + 0.02, 0.1, 0.02, c.top ?? '#f7f7f5', 0, s.h, -s.d / 2 + 0.01)
      // 2 sinks, drains, and faucets
      for (const sx of [-s.w * 0.25, s.w * 0.25]) {
        box(g, 0.48, 0.01, 0.36, '#d4d4d8', sx, s.h, 0.02)
        cyl(g, 0.014, 0.014, 0.2, c.metal ?? '#b4b8bd', sx, s.h, -s.d / 2 + 0.08, 8)
      }
      return g
    }

    if (p.dressingTable) {
      // Dressing table with drawers, round LED mirror, and stool
      const g = new THREE.Group()
      const topT = 0.04
      box(g, s.w, topT, s.d, c.wood ?? '#b8915f', 0, 0.75 - topT, 0)
      box(g, s.w - 0.04, 0.12, s.d - 0.04, c.wood ?? '#b8915f', 0, 0.75 - topT - 0.12, 0)
      legs(g, { w: s.w, d: s.d, h: 0.75 }, 0.75 - topT - 0.12, c.legs ?? '#3f3f46', 0.05, 0.02)
      // Round illuminated mirror
      cyl(g, 0.32, 0.32, 0.02, '#3f3f46', 0, 0.75 + 0.08, -s.d / 2 + 0.04, 28, Math.PI / 2, 0, 0)
      cyl(g, 0.3, 0.3, 0.005, m('#dbeafe', { rough: 0.1 }), 0, 0.75 + 0.08, -s.d / 2 + 0.055, 28, Math.PI / 2, 0, 0)
      // Vanity stool
      box(g, 0.38, 0.06, 0.34, c.fabric ?? '#8e9196', 0, 0.4, 0.06)
      for (const sx of [-0.15, 0.15])
        for (const sz of [-0.13, 0.13])
          cyl(g, 0.015, 0.018, 0.4, '#3f3f46', sx, 0, 0.06 + sz, 8)
      return g
    }

    if (p.sideboard) {
      // Dining sideboard credenza on slim metal legs
      const g = new THREE.Group()
      const legH = 0.18
      legs(g, s, legH, '#27272a', 0.06, 0.018)
      box(g, s.w, s.h - legH, s.d, c.wood ?? '#b8915f', 0, legH, 0)
      const doors = 4
      for (let i = 0; i < doors; i++) {
        box(g, 0.006, s.h - legH - 0.02, 0.005, '#3f3f46', -s.w / 2 + (s.w / doors) * i, legH + 0.01, s.d / 2 + 0.002)
        cyl(g, 0.012, 0.012, 0.02, '#eab308', -s.w / 2 + (s.w / doors) * (i + 0.5), legH + (s.h - legH) * 0.65, s.d / 2 + 0.01, 8, Math.PI / 2, 0, 0)
      }
      box(g, 0.28, 0.03, 0.2, '#f4f4f5', -s.w * 0.25, s.h, 0)
      return g
    }

    const g = new THREE.Group()
    const plinth = 0.08
    const topT = p.worktop ? 0.04 : 0
    box(g, s.w - 0.04, plinth, s.d - 0.06, '#27272a', 0, 0, -0.03)
    box(g, s.w, s.h - plinth - topT, s.d, c.wood, 0, plinth, 0)
    if (p.worktop) box(g, s.w + 0.02, topT, s.d + 0.02, c.top, 0, s.h - topT, 0.01)
    const handle = c.metal ?? '#52525b'
    const bodyH = s.h - plinth - topT
    const drawers = Number(p.drawers ?? 0)
    const doors = Number(p.doors ?? 0)
    if (drawers)
      for (let i = 0; i < drawers; i++) {
        const y = plinth + (bodyH / drawers) * (i + 0.5)
        box(g, s.w - 0.04, 0.006, 0.005, '#52525b', 0, plinth + (bodyH / drawers) * i, s.d / 2 + 0.002)
        box(g, 0.12, 0.02, 0.02, handle, 0, y, s.d / 2 + 0.01)
      }
    else
      for (let i = 0; i < doors; i++) {
        const x = -s.w / 2 + (s.w / doors) * (i + 0.5)
        box(g, 0.006, bodyH - 0.02, 0.005, '#52525b', -s.w / 2 + (s.w / doors) * i, plinth + 0.01, s.d / 2 + 0.002)
        box(g, 0.02, 0.14, 0.02, handle, x + (i % 2 ? -1 : 1) * (s.w / doors / 2 - 0.05), plinth + bodyH * 0.75, s.d / 2 + 0.01)
      }
    if (p.sink) {
      box(g, s.w * 0.7, 0.012, s.d * 0.6, '#a1a1aa', 0, s.h - 0.005, 0)
      cyl(g, 0.012, 0.012, 0.25, handle, 0, s.h, -s.d / 2 + 0.08, 8)
    }
    return g
  },

  shelf(s, c) {
    const g = new THREE.Group()
    const t = 0.02
    for (const sx of [-1, 1]) box(g, t, s.h, s.d, c.wood, sx * (s.w / 2 - t / 2), 0, 0)
    box(g, s.w, s.h, t, c.wood, 0, 0, -s.d / 2 + t / 2)
    const n = 5
    const books = ['#9b3d3d', '#3d5a9b', '#c9a24a', '#4a7d5a', '#6b4f7d', '#d9d4c7']
    for (let i = 0; i <= n; i++) {
      const y = (s.h - t) * (i / n)
      box(g, s.w - 2 * t, t, s.d - t, c.wood, 0, y, t / 2)
      if (i < n)
        for (let k = 0, x = -s.w / 2 + t + 0.02; x < s.w / 2 - 0.08 && k < 14; k++) {
          const bw = 0.03 + ((k * 7 + i * 3) % 4) * 0.01
          if ((k + i) % 5 !== 4) box(g, bw, 0.18 + ((k + i) % 3) * 0.03, s.d * 0.7, books[(k + i) % books.length], x + bw / 2, y + t, 0.02)
          x += bw + 0.005
        }
    }
    return g
  },

  rug(s, c) {
    const g = new THREE.Group()
    const fabricColor = c.fabric ?? '#8e9196'
    box(g, s.w, s.h, s.d, m(fabricColor, { rough: 1 }))
    box(g, s.w - 0.2, s.h + 0.001, s.d - 0.2, m(new THREE.Color(fabricColor).offsetHSL(0, 0, 0.12).getStyle(), { rough: 1 }))
    return g
  },

  appliance(s, c, p) {
    const g = new THREE.Group()
    const bodyColor = c.body ?? '#c9ccd1'
    const trimColor = c.trim ?? '#2f2f33'

    if (p.kind === 'fridge-double') {
      // Modern French Door Refrigerator
      box(g, s.w, s.h, s.d, m(bodyColor, { rough: 0.3, metal: 0.4 }))
      box(g, s.w - 0.02, 0.01, 0.01, trimColor, 0, s.h * 0.42, s.d / 2 + 0.002)
      box(g, 0.008, s.h * 0.56, 0.01, trimColor, 0, s.h * 0.43, s.d / 2 + 0.002)
      // Vertical door handles
      box(g, 0.025, 0.55, 0.03, trimColor, -0.04, s.h * 0.65, s.d / 2 + 0.02)
      box(g, 0.025, 0.55, 0.03, trimColor, 0.04, s.h * 0.65, s.d / 2 + 0.02)
      // Ice dispenser on left door
      box(g, 0.18, 0.24, 0.01, '#18181b', -s.w * 0.25, s.h * 0.68, s.d / 2 + 0.002)
      // Bottom freezer drawer handle
      box(g, s.w * 0.6, 0.025, 0.03, trimColor, 0, s.h * 0.36, s.d / 2 + 0.02)
      return g
    }

    if (p.kind === 'range-hood') {
      // Stainless steel chimney range hood
      const flueW = s.w * 0.35
      const flueD = s.d * 0.55
      const flueH = s.h * 0.65
      // Chimney flue
      box(g, flueW, flueH, flueD, m(bodyColor, { rough: 0.25, metal: 0.5 }), 0, s.h - flueH, -s.d / 2 + flueD / 2)
      // Canopy hood
      box(g, s.w, s.h - flueH, s.d, m(bodyColor, { rough: 0.25, metal: 0.5 }), 0, 0, 0)
      // Filter grid underneath
      box(g, s.w - 0.08, 0.01, s.d - 0.08, '#71717a', 0, 0.01, 0)
      return g
    }

    if (p.kind === 'dishwasher') {
      // Built-in undercounter dishwasher
      box(g, s.w, s.h, s.d, m(bodyColor, { rough: 0.35, metal: 0.4 }))
      box(g, s.w, 0.12, 0.01, '#27272a', 0, s.h - 0.12, s.d / 2 + 0.002)
      box(g, s.w * 0.75, 0.025, 0.03, trimColor, 0, s.h - 0.16, s.d / 2 + 0.02)
      box(g, s.w, 0.08, 0.04, '#1f1f22', 0, 0, s.d / 2 - 0.02)
      return g
    }

    box(g, s.w, s.h, s.d, m(bodyColor, { rough: 0.35 }))
    if (p.kind === 'fridge') {
      box(g, s.w - 0.01, 0.008, 0.005, trimColor, 0, s.h * 0.62, s.d / 2 + 0.002)
      for (const [y, h] of [
        [s.h * 0.7, 0.3],
        [s.h * 0.3, 0.4]
      ])
        box(g, 0.02, h, 0.03, trimColor, s.w / 2 - 0.06, y, s.d / 2 + 0.015)
    } else {
      box(g, s.w, 0.01, s.d, '#18181b', 0, s.h, 0)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cyl(g, 0.08, 0.08, 0.012, '#3f3f46', sx * s.w * 0.22, s.h, sz * s.d * 0.22)
      box(g, s.w * 0.8, s.h * 0.45, 0.01, m('#18181b', { rough: 0.2 }), 0, s.h * 0.2, s.d / 2 + 0.003)
      box(g, s.w * 0.7, 0.025, 0.03, trimColor, 0, s.h * 0.7, s.d / 2 + 0.02)
    }
    return g
  },

  toilet(s, c) {
    const g = new THREE.Group()
    box(g, s.w * 0.55, 0.38, s.d * 0.5, c.ceramic, 0, 0, s.d * 0.05)
    const bowl = cyl(g, s.w / 2, s.w * 0.35, 0.08, c.ceramic, 0, 0.36, s.d * 0.12)
    bowl.scale.z = 1.3
    // Toilet seat & lid
    cyl(g, s.w * 0.48, s.w * 0.48, 0.02, '#f4f4f5', 0, 0.44, s.d * 0.12)
    // Tank with flush buttons
    box(g, s.w, 0.38, 0.18, c.ceramic, 0, 0.42, -s.d / 2 + 0.09)
    cyl(g, 0.02, 0.02, 0.01, '#c9ccd1', -0.03, 0.8, -s.d / 2 + 0.09)
    cyl(g, 0.02, 0.02, 0.01, '#c9ccd1', 0.03, 0.8, -s.d / 2 + 0.09)
    return g
  },

  basin(s, c) {
    const g = new THREE.Group()
    box(g, s.w, s.h - 0.15, s.d, c.wood ?? '#b8915f', 0, 0, 0)
    box(g, s.w, 0.15, s.d, c.ceramic, 0, s.h - 0.15, 0)
    box(g, s.w, 0.08, 0.02, c.ceramic, 0, s.h, -s.d / 2 + 0.01) // Splashback
    box(g, s.w * 0.75, 0.01, s.d * 0.6, '#d4d4d8', 0, s.h, 0.02)
    cyl(g, 0.012, 0.012, 0.18, c.metal, 0, s.h, -s.d / 2 + 0.06, 8)
    return g
  },

  bathtub(s, c) {
    const g = new THREE.Group()
    const r = 0.06
    box(g, s.w, s.h, s.d, c.ceramic)
    box(g, s.w - 2 * r - 0.06, 0.005, s.d - 2 * r, m('#bfe0ee', { rough: 0.1 }), 0, s.h - 0.06, 0)
    for (const sx of [-1, 1]) box(g, s.w, 0.06, r, c.ceramic, 0, s.h - 0.06, sx * (s.d / 2 - r / 2))
    cyl(g, 0.015, 0.015, 0.2, c.metal, s.w / 2 - 0.1, s.h, -s.d / 2 + 0.05, 8)
    return g
  },

  freestandingTub(s, c) {
    // Luxury freestanding oval soaking tub
    const g = new THREE.Group()
    const tub = cyl(g, s.w / 2, (s.w / 2) * 0.78, s.h, c.ceramic ?? '#f7f7f5', 0, 0, 0, 32)
    tub.scale.z = s.d / s.w
    // Water surface
    const water = cyl(g, (s.w / 2) * 0.85, (s.w / 2) * 0.85, 0.005, m('#bfe0ee', { rough: 0.1 }), 0, s.h - 0.08, 0, 32)
    water.scale.z = s.d / s.w
    // Freestanding floor pillar mixer faucet
    cyl(g, 0.02, 0.02, s.h + 0.2, c.metal ?? '#b4b8bd', s.w / 2 - 0.08, 0, 0, 12)
    cyl(g, 0.012, 0.012, 0.14, c.metal ?? '#b4b8bd', s.w / 2 - 0.15, s.h + 0.18, 0, 8, 0, 0, Math.PI / 2)
    return g
  },

  shower(s, c) {
    const g = new THREE.Group()
    box(g, s.w, 0.06, s.d, c.ceramic)
    const glass = m('#cfe3ef', { opacity: 0.3, rough: 0.05 })
    box(g, s.w, s.h - 0.06, 0.01, glass, 0, 0.06, s.d / 2 - 0.005)
    box(g, 0.01, s.h - 0.06, s.d, glass, s.w / 2 - 0.005, 0.06, 0)
    cyl(g, 0.012, 0.012, s.h - 0.2, c.metal, -s.w / 2 + 0.08, 0.06, -s.d / 2 + 0.05, 8)
    cyl(g, 0.1, 0.1, 0.02, c.metal, -s.w / 2 + 0.18, s.h - 0.2, -s.d / 2 + 0.15)
    return g
  },

  walkinShower(s, c) {
    // Frameless walk-in glass shower enclosure
    const g = new THREE.Group()
    box(g, s.w, 0.04, s.d, c.ceramic ?? '#27272a') // Slate shower pan
    box(g, 0.06, 0.005, s.d * 0.6, '#a1a1aa', s.w / 2 - 0.08, 0.04, 0) // Linear drain
    // Frameless glass screen along front edge
    const glass = m('#cfe3ef', { opacity: 0.25, rough: 0.05 })
    box(g, s.w * 0.72, s.h - 0.04, 0.012, glass, -s.w * 0.14, 0.04, s.d / 2 - 0.01)
    const metalColor = c.metal ?? '#18181b'
    box(g, 0.02, s.h - 0.04, 0.02, metalColor, -s.w / 2 + 0.01, 0.04, s.d / 2 - 0.01) // Wall profile
    // Square rain showerhead from high wall
    cyl(g, 0.012, 0.012, 0.35, metalColor, -s.w / 2 + 0.2, s.h - 0.18, -s.d / 2 + 0.04, 8, Math.PI / 2, 0, 0)
    box(g, 0.22, 0.015, 0.22, metalColor, -s.w / 2 + 0.2, s.h - 0.22, -s.d / 2 + 0.2)
    // Mixer bar
    box(g, 0.08, 0.24, 0.05, metalColor, -s.w / 2 + 0.04, 1.0, -s.d / 2 + 0.2)
    return g
  },

  towelRadiator(s, c) {
    // Heated ladder towel radiator with folded towel
    const g = new THREE.Group()
    const color = c.metal ?? '#b4b8bd'
    for (const sx of [-s.w / 2 + 0.03, s.w / 2 - 0.03]) {
      cyl(g, 0.018, 0.018, s.h, color, sx, 0, 0, 12)
    }
    const rungs = 8
    for (let i = 0; i < rungs; i++) {
      cyl(g, 0.01, 0.01, s.w - 0.06, color, 0, 0.12 + i * ((s.h - 0.2) / (rungs - 1)), 0, 8, 0, 0, Math.PI / 2)
    }
    // Hung bath towel
    box(g, s.w * 0.65, 0.38, 0.04, '#e4e4e7', 0, 0.45, 0.02)
    return g
  },

  lamp(s, c, p) {
    const g = new THREE.Group()
    const metalColor = c.metal ?? '#27272a'
    const shadeColor = m(c.shade ?? '#fef3c7', { rough: 1 })
    if (p.chandelier) {
      // Modern luxury multi-ring chandelier
      cyl(g, 0.006, 0.006, s.h * 0.4, metalColor, 0, s.h * 0.6, 0, 8)
      cyl(g, s.w * 0.42, s.w * 0.42, 0.03, metalColor, 0, s.h * 0.5, 0, 32)
      cyl(g, s.w * 0.26, s.w * 0.26, 0.03, metalColor, 0, s.h * 0.35, 0, 24)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ball(g, 0.06, '#fef9c3', Math.sin(a) * (s.w * 0.42), s.h * 0.5, Math.cos(a) * (s.w * 0.42))
      }
      return g
    }
    if (p.sconce) {
      // Architectural up/down wall sconce
      box(g, s.w, s.h, s.d, metalColor)
      box(g, s.w * 0.8, 0.02, s.d * 0.8, '#fef3c7', 0, s.h - 0.02, 0)
      box(g, s.w * 0.8, 0.02, s.d * 0.8, '#fef3c7', 0, 0.01, 0)
      return g
    }
    if (p.ceilingFan) {
      // Ceiling fan with light
      cyl(g, 0.015, 0.015, s.h * 0.5, metalColor, 0, s.h * 0.5, 0, 8)
      cyl(g, 0.12, 0.14, 0.1, metalColor, 0, s.h * 0.4, 0, 16)
      ball(g, 0.08, '#fef9c3', 0, s.h * 0.35, 0, 0.5)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        const blade = box(g, 0.12, 0.01, s.w * 0.42, c.wood ?? '#6e4b32', 0, s.h * 0.45, (s.w * 0.42) / 2)
        blade.rotation.y = a
        blade.rotation.x = 0.08
      }
      return g
    }
    if (p.pendant) {
      cyl(g, 0.005, 0.005, s.h * 0.6, metalColor, 0, s.h * 0.4, 0, 6)
      cyl(g, 0.06, s.w / 2, s.h * 0.4, shadeColor)
    } else if (p.bollard) {
      cyl(g, s.w * 0.3, s.w * 0.35, s.h * 0.8, metalColor)
      cyl(g, s.w * 0.4, s.w * 0.4, s.h * 0.15, shadeColor, 0, s.h * 0.8, 0)
      cyl(g, s.w * 0.45, s.w * 0.45, s.h * 0.05, metalColor, 0, s.h * 0.95, 0)
    } else {
      cyl(g, s.w * 0.35, s.w * 0.4, 0.03, metalColor)
      cyl(g, 0.012, 0.012, s.h * 0.8, metalColor, 0, 0.03, 0, 8)
      cyl(g, s.w * 0.3, s.w / 2, s.h * 0.2, shadeColor, 0, s.h * 0.8, 0)
    }
    return g
  },

  wallArt(s, c) {
    const g = new THREE.Group()
    box(g, s.w, s.h, s.d, c.frame ?? '#27272a')
    box(g, s.w - 0.06, s.h - 0.06, s.d + 0.002, '#f4f3ef', 0, 0.03, 0.001)
    // Abstract geometric art composition
    box(g, (s.w - 0.06) * 0.55, (s.h - 0.06) * 0.6, 0.004, c.art ?? '#4f6d8f', -0.06, 0.1, 0.003)
    cyl(g, 0.15, 0.15, 0.005, '#c2703d', 0.12, (s.h - 0.06) * 0.5, 0.004, 24, Math.PI / 2, 0, 0)
    return g
  },

  floorMirror(s, c) {
    const g = new THREE.Group()
    box(g, s.w, s.h, 0.03, c.frame ?? '#27272a', 0, 0, 0, -0.08, 0, 0)
    box(g, s.w - 0.06, s.h - 0.08, 0.005, m('#bfdbfe', { rough: 0.1 }), 0, 0.04, 0.016, -0.08, 0, 0)
    cyl(g, 0.012, 0.012, s.h * 0.85, c.frame ?? '#27272a', 0, 0, -s.d * 0.45, 8, 0.25, 0, 0)
    return g
  },

  fireplace(s, c) {
    const g = new THREE.Group()
    box(g, s.w, s.h, s.d, c.stone ?? '#3f3f46')
    // Black recessed firebox
    box(g, s.w * 0.72, s.h * 0.55, s.d * 0.6, '#18181b', 0, s.h * 0.18, s.d * 0.2)
    // Glowing ember bed
    box(g, s.w * 0.65, 0.04, s.d * 0.45, '#ea580c', 0, s.h * 0.19, s.d * 0.2)
    // Wood logs
    cyl(g, 0.03, 0.03, s.w * 0.45, '#78350f', 0, s.h * 0.22, s.d * 0.2, 8, 0, 0, Math.PI / 2)
    // Mantel shelf on top
    box(g, s.w + 0.06, 0.05, s.d + 0.05, c.wood ?? '#b8915f', 0, s.h - 0.05, 0.02)
    return g
  },

  pouf(s, c) {
    const g = new THREE.Group()
    const r = s.w / 2
    cyl(g, r, r * 0.95, s.h - 0.04, c.fabric ?? '#8e9196', 0, 0, 0, 24)
    cyl(g, r * 0.98, r, 0.04, c.fabric ?? '#8e9196', 0, s.h - 0.04, 0, 24)
    ball(g, 0.025, shade(c.fabric ?? '#8e9196', 0, -0.2), 0, s.h, 0)
    return g
  },

  plant(s, c) {
    const g = new THREE.Group()
    const potH = s.h * 0.3
    const pr = s.w * 0.3
    cyl(g, pr, pr * 0.78, potH, c.pot)
    cyl(g, pr * 1.06, pr * 1.06, potH * 0.12, c.pot, 0, potH * 0.88, 0)
    cyl(g, pr * 0.95, pr * 0.95, 0.01, '#4a3a2c', 0, potH * 0.86, 0)
    const rand = rng(5)
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rand() * 0.4
      const reach = s.w * (0.18 + rand() * 0.24)
      const top = potH + (s.h - potH) * (0.45 + rand() * 0.5)
      const base = new THREE.Vector3(0, potH * 0.9, 0)
      const tip = new THREE.Vector3(Math.cos(a) * reach, top, Math.sin(a) * reach)
      limb(g, base, tip, 0.008, 0.005, shade(c.leaf, 0, -0.08))
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), flat(shade(c.leaf, (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08)))
      leaf.scale.set(s.w * 0.07, 0.012, s.w * 0.16)
      leaf.position.copy(tip)
      leaf.rotation.set(0.5 + rand() * 0.4, -a + Math.PI / 2, 0)
      g.add(leaf)
    }
    return g
  },

  monstera(s, c) {
    // Large Monstera in fluted ceramic planter with broad leaves
    const g = new THREE.Group()
    const potH = s.h * 0.35
    const pr = s.w * 0.32
    cyl(g, pr, pr * 0.8, potH, c.pot ?? '#ecebe7', 0, 0, 0, 24)
    cyl(g, pr * 0.94, pr * 0.94, 0.02, '#3f2e21', 0, potH * 0.9, 0, 16)
    const leafColor = c.leaf ?? '#2d5a27'
    const rand = rng(7)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.3
      const reach = s.w * (0.25 + rand() * 0.22)
      const top = potH + (s.h - potH) * (0.4 + rand() * 0.55)
      const base = new THREE.Vector3(0, potH * 0.9, 0)
      const tip = new THREE.Vector3(Math.cos(a) * reach, top, Math.sin(a) * reach)
      limb(g, base, tip, 0.01, 0.006, shade(leafColor, 0, -0.1))
      // Broad perforated-look Monstera leaf
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 1.4), flat(shade(leafColor, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.08)))
      leaf.scale.set(s.w * 0.16, 1, s.w * 0.18)
      leaf.position.copy(tip)
      leaf.rotation.set(0.6 + rand() * 0.3, -a + Math.PI / 2, 0)
      g.add(leaf)
    }
    return g
  },

  pottedTree(s, c) {
    // Fiddle-leaf fig tree in basket planter
    const g = new THREE.Group()
    const potH = s.h * 0.28
    const pr = s.w * 0.35
    cyl(g, pr, pr * 0.85, potH, c.pot ?? '#8b6b4a', 0, 0, 0, 16)
    cyl(g, pr * 0.95, pr * 0.95, 0.02, '#3f2e21', 0, potH * 0.92, 0, 16)
    // Upright woody trunk
    const trunkColor = c.trunk ?? '#5a4230'
    limb(g, new THREE.Vector3(0, potH * 0.9, 0), new THREE.Vector3(0, s.h * 0.85, 0), 0.025, 0.015, trunkColor)
    // Clusters of broad violin-shaped leaves
    const leafColor = c.leaf ?? '#2f6930'
    const rand = rng(12)
    for (let i = 0; i < 14; i++) {
      const a = (i * 2.4) + rand() * 0.2
      const y = potH * 1.1 + (s.h - potH * 1.1) * (i / 13)
      const reach = s.w * (0.16 + (i / 13) * 0.22)
      const tip = new THREE.Vector3(Math.cos(a) * reach, y, Math.sin(a) * reach)
      limb(g, new THREE.Vector3(0, y - 0.05, 0), tip, 0.008, 0.005, trunkColor)
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 1.6), flat(shade(leafColor, (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08)))
      leaf.scale.set(s.w * 0.14, 1, s.w * 0.16)
      leaf.position.copy(tip)
      leaf.rotation.set(0.4, -a + Math.PI / 2, 0)
      g.add(leaf)
    }
    return g
  },

  tree(s, c, p) {
    const g = new THREE.Group()
    const rand = rng(Number(p.seed ?? 1))
    const birch = !!p.birch
    const R = s.w * (birch ? 0.3 : 0.34)
    const crownY = s.h - R * (birch ? 1.25 : 0.95)
    const trunkTop = crownY - R * 0.1
    const r0 = s.w * (birch ? 0.03 : 0.045)
    const bark = birch ? '#e9e6df' : c.trunk
    const lean = new THREE.Vector3((rand() - 0.5) * s.w * 0.05, trunkTop, (rand() - 0.5) * s.w * 0.05)
    limb(g, new THREE.Vector3(0, 0, 0), lean, r0, r0 * 0.7, bark)
    if (birch) for (let i = 0; i < 7; i++) box(g, r0 * 2.05, 0.03, r0 * 0.9, '#3f3f46', 0, 0.3 + i * (trunkTop / 8) + rand() * 0.1, r0 * 0.6 * (rand() - 0.5))
    const detail = R > 0.9 ? 2 : 1
    const clumps: [number, number, number, number][] = [[0, crownY + R * 0.3, 0, R * 0.62]]
    const n = 8 + Math.round(R * 5)
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + rand() * 0.3
      const k = Math.sqrt((i + 0.5) / n)
      const d = R * (0.2 + 0.55 * k)
      const y = crownY + R * (0.45 - 0.75 * k) + (rand() - 0.5) * R * 0.2
      clumps.push([Math.cos(a) * d, y, Math.sin(a) * d, R * (0.5 - 0.18 * k + rand() * 0.08)])
    }
    const fork = lean.clone().multiplyScalar(0.7)
    for (const [x, y, z] of clumps.filter((_, i) => i % 3 === 1).slice(0, 6)) limb(g, fork, new THREE.Vector3(x * 0.75, y - R * 0.15, z * 0.75), r0 * 0.5, r0 * 0.2, bark)
    clumps.forEach(([x, y, z, r], i) => clump(g, r, shade(c.leaf, (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08), x, y, z, i * 17 + 3, birch ? 1.25 : 0.95, detail))
    return g
  },

  conifer(s, c, p) {
    const g = new THREE.Group()
    const rand = rng(Number(p.seed ?? 2))
    cyl(g, s.w * 0.04, s.w * 0.06, s.h * 0.18, c.trunk, 0, 0, 0, 8)
    const layers = 5
    for (let i = 0; i < layers; i++) {
      const k = i / (layers - 1)
      const r = (s.w / 2) * (1 - k * 0.78)
      const hgt = s.h * 0.34 * (1 - k * 0.35)
      const geo = new THREE.ConeGeometry(r, hgt, 11, 2)
      const pos = geo.attributes.position
      for (let j = 0; j < pos.count; j++) {
        const [x, y, z] = [pos.getX(j), pos.getY(j), pos.getZ(j)]
        const f = 0.85 + 0.3 * hash(Math.round(x * 997) + i, Math.round(y * 997), Math.round(z * 997))
        pos.setXYZ(j, x * f, y, z * f)
      }
      geo.computeVertexNormals()
      const cone = new THREE.Mesh(geo, flat(shade(c.leaf, 0, (rand() - 0.5) * 0.06 - k * 0.03)))
      cone.position.y = s.h * 0.15 + k * (s.h * 0.85 - hgt) + hgt / 2
      cone.rotation.y = rand() * Math.PI
      g.add(cone)
    }
    return g
  },

  palm(s, c) {
    const g = new THREE.Group()
    const segs = 9
    const trunkH = s.h * 0.82
    let prev = new THREE.Vector3(0, 0, 0)
    for (let i = 1; i <= segs; i++) {
      const k = i / segs
      const next = new THREE.Vector3(s.w * 0.12 * k * k, trunkH * k, 0)
      limb(g, prev, next, s.w * (0.05 - 0.015 * k), s.w * (0.045 - 0.015 * k), i % 2 ? c.trunk : shade(c.trunk, 0, 0.08))
      prev = next
    }
    const top = prev
    const len = s.w * 0.52
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.PlaneGeometry(len, s.w * 0.12, 8, 1).translate(len / 2, 0, 0)
      const pos = geo.attributes.position
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j)
        const taper = 1 - (x / len) * 0.85
        pos.setY(j, pos.getY(j) * taper)
        pos.setZ(j, -((x / len) ** 2) * len * 0.55)
      }
      geo.computeVertexNormals()
      const frond = new THREE.Mesh(geo, frondMat(c.leaf))
      frond.position.copy(top)
      frond.rotation.set(-Math.PI / 2, 0, (i / 10) * Math.PI * 2)
      frond.rotateY(-0.35)
      g.add(frond)
    }
    for (let i = 0; i < 3; i++) ball(g, s.w * 0.035, '#5a4632', top.x + Math.cos(i * 2.1) * 0.08, top.y - 0.08, Math.sin(i * 2.1) * 0.08)
    return g
  },

  bush(s, c, p) {
    const g = new THREE.Group()
    const rand = rng(Number(p.seed ?? 4))
    const r = s.w / 2
    const n = 6
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand()
      const d = i ? r * (0.3 + rand() * 0.2) : 0
      const cr = r * (i ? 0.45 + rand() * 0.12 : 0.6)
      clump(g, cr, shade(c.leaf, (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.1), Math.cos(a) * d, Math.min(s.h - cr * 0.9, cr * 0.8 + rand() * s.h * 0.25), Math.sin(a) * d, i * 31 + 7, s.h / s.w + 0.1)
    }
    if (p.flowers)
      for (let i = 0; i < 26; i++) {
        const a = rand() * Math.PI * 2
        const up = 0.2 + rand() * 0.8
        ball(g, 0.03, c.flower ?? '#e25d6e', Math.cos(a) * r * 0.75 * (1 - up * 0.4), s.h * (0.35 + up * 0.5), Math.sin(a) * r * 0.75 * (1 - up * 0.4))
      }
    return g
  },

  hedge(s, c) {
    const g = new THREE.Group()
    box(g, s.w * 0.96, s.h * 0.85, s.d * 0.9, flat(shade(c.leaf, 0, -0.05)))
    const n = Math.max(2, Math.round(s.w / 0.45))
    for (let i = 0; i < n; i++) clump(g, s.d * 0.5, shade(c.leaf, 0, ((i * 7) % 5) * 0.015 - 0.03), -s.w / 2 + s.d * 0.45 + (i / (n - 1)) * (s.w - s.d * 0.9), s.h - s.d * 0.5, 0, i * 13, 1)
    return g
  },

  flowerBed(s, c) {
    const g = new THREE.Group()
    box(g, s.w, 0.2, s.d, '#8b6b4a')
    box(g, s.w - 0.08, 0.02, s.d - 0.08, '#5b4636', 0, 0.2, 0)
    const petals = ['#e25d6e', '#f2c14e', '#b580d1', '#f4f4f5']
    for (let i = 0; i < Math.round(s.w * 6); i++) {
      const x = -s.w / 2 + 0.1 + ((i * 0.37) % 1) * (s.w - 0.2)
      const z = -s.d / 2 + 0.1 + ((i * 0.61) % 1) * (s.d - 0.2)
      ball(g, 0.06, i % 3 ? c.leaf : petals[i % petals.length], x, 0.26 + (i % 2) * 0.04, z)
    }
    return g
  },

  bench(s, c) {
    const g = new THREE.Group()
    const seat = 0.45
    for (const sx of [-1, 1]) {
      box(g, 0.05, seat, s.d * 0.8, '#3f3f46', sx * (s.w / 2 - 0.1), 0, 0)
      box(g, 0.05, s.h - seat, 0.05, '#3f3f46', sx * (s.w / 2 - 0.1), seat, -s.d / 2 + 0.06)
    }
    for (let i = 0; i < 4; i++) box(g, s.w, 0.03, s.d / 5, c.wood, 0, seat, -s.d / 2 + (s.d / 4) * (i + 0.5))
    for (let i = 0; i < 2; i++) box(g, s.w, s.d / 6, 0.03, c.wood, 0, seat + 0.1 + i * 0.15, -s.d / 2 + 0.05)
    return g
  },

  parasol(s, c) {
    const g = new THREE.Group()
    const metalColor = c.metal ?? '#71717a'
    const canvasColor = c.canvas ?? '#efe6d2'
    cyl(g, 0.25, 0.25, 0.06, metalColor)
    cyl(g, 0.02, 0.02, s.h - 0.1, metalColor, 0, 0.06, 0, 8)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(s.w / 2, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ color: canvasColor, side: THREE.DoubleSide }))
    canopy.position.y = s.h - 0.3
    g.add(canopy)
    return g
  },

  sunLounger(s, c) {
    // Reclining outdoor poolside sun lounger
    const g = new THREE.Group()
    const seatH = 0.28
    // Slatted teak / aluminum frame
    box(g, s.w, 0.04, s.d * 0.95, c.frame ?? '#8b6b4a', 0, seatH - 0.04, 0)
    for (const sx of [-s.w / 2 + 0.04, s.w / 2 - 0.04]) {
      // 4 legs
      box(g, 0.04, seatH, 0.04, '#27272a', sx, 0, s.d * 0.35)
      // Rear wheels
      cyl(g, 0.07, 0.07, 0.03, '#27272a', sx, 0, -s.d * 0.38, 12, 0, 0, Math.PI / 2)
    }
    // Main mattress cushion
    box(g, s.w - 0.04, 0.08, s.d * 0.6, c.fabric ?? '#efe6d2', 0, seatH, s.d * 0.15)
    // Angled recline backrest cushion
    box(g, s.w - 0.04, 0.08, s.d * 0.38, c.fabric ?? '#efe6d2', 0, seatH + 0.12, -s.d * 0.26, 0.38, 0, 0)
    // Pillow
    box(g, s.w * 0.6, 0.06, 0.2, shade(c.fabric ?? '#efe6d2', 0, -0.15), 0, seatH + 0.22, -s.d * 0.36, 0.38, 0, 0)
    return g
  },

  bbqGrill(s, c) {
    // Luxury outdoor barbecue grill cart
    const g = new THREE.Group()
    const cartH = s.h * 0.58
    // Cart cabinet with double doors
    box(g, s.w * 0.55, cartH - 0.1, s.d * 0.85, c.body ?? '#27272a', 0, 0.1, 0)
    // 4 caster wheels
    for (const sx of [-s.w * 0.22, s.w * 0.22])
      for (const sz of [-s.d * 0.35, s.d * 0.35])
        cyl(g, 0.04, 0.04, 0.08, '#18181b', sx, 0, sz, 8)
    // Side prep shelves on left & right
    for (const sx of [-1, 1]) {
      box(g, s.w * 0.22, 0.04, s.d * 0.82, '#71717a', sx * (s.w * 0.38), cartH - 0.04, 0)
    }
    // Main cookbox
    box(g, s.w * 0.55, 0.15, s.d * 0.88, '#18181b', 0, cartH, 0)
    // Domed hood with handle
    const hood = cyl(g, s.d * 0.42, s.d * 0.42, s.w * 0.53, m(c.hood ?? '#3f3f46', { rough: 0.3, metal: 0.4 }), 0, cartH + 0.15, -0.02, 16, 0, 0, Math.PI / 2)
    hood.scale.y = 0.75
    // Hood handle & temperature gauge
    box(g, s.w * 0.35, 0.02, 0.03, '#c9ccd1', 0, cartH + 0.25, s.d * 0.38)
    cyl(g, 0.025, 0.025, 0.015, '#c9ccd1', 0, cartH + 0.36, s.d * 0.25, 12, 0.6, 0, 0)
    // 4 burner control knobs
    for (let i = 0; i < 4; i++) {
      cyl(g, 0.02, 0.02, 0.02, '#c9ccd1', -s.w * 0.18 + i * 0.12, cartH + 0.06, s.d * 0.45, 8, Math.PI / 2, 0, 0)
    }
    return g
  },

  firePit(s, c) {
    // Outdoor stone fire pit with lava rocks
    const g = new THREE.Group()
    const r = s.w / 2
    // Outer stone ring
    cyl(g, r, r * 0.95, s.h * 0.85, c.stone ?? '#8b6b4a', 0, 0, 0, 24)
    cyl(g, r * 1.05, r * 1.05, s.h * 0.15, c.stone ?? '#785f44', 0, s.h * 0.85, 0, 24)
    // Inner steel fire bowl
    cyl(g, r * 0.72, r * 0.65, s.h * 0.6, '#18181b', 0, s.h * 0.3, 0, 20)
    // Glowing lava rocks & embers
    cyl(g, r * 0.68, r * 0.68, 0.05, '#ea580c', 0, s.h * 0.7, 0, 16)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      ball(g, 0.05, '#451a03', Math.sin(a) * r * 0.35, s.h * 0.76, Math.cos(a) * r * 0.35)
    }
    return g
  },

  pergola(s, c) {
    // Outdoor timber pergola with 4 posts and roof rafters
    const g = new THREE.Group()
    const woodColor = c.wood ?? '#6e4b32'
    const postW = 0.12
    // 4 corner posts
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        box(g, postW, s.h - 0.18, postW, woodColor, sx * (s.w / 2 - postW / 2), 0, sz * (s.d / 2 - postW / 2))
    // 2 longitudinal main support beams
    for (const sx of [-s.w / 2 + postW / 2, s.w / 2 - postW / 2]) {
      box(g, 0.08, 0.18, s.d + 0.3, woodColor, sx, s.h - 0.18, 0)
    }
    // 7 cross rafters across the roof
    const n = 7
    for (let i = 0; i < n; i++) {
      const z = -s.d / 2 + (s.d / (n - 1)) * i
      box(g, s.w + 0.3, 0.14, 0.06, woodColor, 0, s.h - 0.14, z)
    }
    return g
  },

  patioSet(s, c) {
    // Outdoor patio dining table with 4 wicker chairs
    const g = new THREE.Group()
    const topT = 0.04
    box(g, s.w, topT, s.d, c.wood ?? '#5a4230', 0, s.h - topT, 0)
    legs(g, s, s.h - topT, '#27272a', 0.06, 0.025)
    // 4 outdoor chairs
    for (const sx of [-s.w * 0.25, s.w * 0.25]) {
      for (const side of [-1, 1]) {
        const ch = B.chair({ w: 0.48, d: 0.48, h: 0.85 }, c, {})
        ch.position.set(sx, 0, side * (s.d / 2 + 0.14))
        ch.rotation.y = side > 0 ? Math.PI : 0
        g.add(ch)
      }
    }
    return g
  }
}

export function buildProcedural(builder: string, size: [number, number, number], colors: Colors, params: Record<string, unknown> = {}) {
  const b = B[builder]
  const [w, d, h] = size
  if (b) return b({ w, d, h }, colors, params)
  const g = new THREE.Group() // unknown builder: a labelled-size placeholder box
  box(g, w, h, d, '#a1a1aa')
  return g
}
