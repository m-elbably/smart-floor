// Procedural furniture from boxes, cylinders and spheres. Local frame (three.js): origin at the
// footprint centre on the floor, width along x, depth along z with the FRONT facing +z, height along y.
import * as THREE from 'three'

type Size = { w: number; d: number; h: number }
type Colors = Record<string, string>
type Builder = (s: Size, c: Colors, p: Record<string, unknown>) => THREE.Group

const mats = new Map<string, THREE.Material>()
function m(color: string, opts: { opacity?: number; rough?: number } = {}) {
  const key = `${color}${opts.opacity ?? 1}${opts.rough ?? 0.8}`
  let mat = mats.get(key)
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.8, transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1 })
    mats.set(key, mat)
  }
  return mat
}

/** Box by extents: x/z centre, y from its bottom. */
function box(g: THREE.Group, w: number, h: number, d: number, color: string | THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? m(color) : color)
  mesh.position.set(x, y + h / 2, z)
  g.add(mesh)
  return mesh
}
function cyl(g: THREE.Group, rTop: number, rBot: number, h: number, color: string | THREE.Material, x = 0, y = 0, z = 0, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), typeof color === 'string' ? m(color) : color)
  mesh.position.set(x, y + h / 2, z)
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
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, r, r, h, color, sx * (s.w / 2 - inset), 0, sz * (s.d / 2 - inset), 8)
}

// ---------- natural shapes ----------

/** Deterministic pseudo-random sequence, so every tree of a kind is the same model (it's instanced). */
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

/** A lumpy, faceted clump of leaves: an icosphere with every vertex pushed in or out a little. */
function clump(g: THREE.Group, r: number, color: string, x: number, y: number, z: number, seed: number, sy = 1, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(r, detail)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const [vx, vy, vz] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
    // same position → same push, so the shared corners of faces stay together
    const k = 0.78 + 0.44 * hash(Math.round(vx * 997) + seed, Math.round(vy * 997), Math.round(vz * 997))
    pos.setXYZ(i, vx * k, vy * k, vz * k)
  }
  geo.computeVertexNormals()
  // every facet a slightly different green, like light catching separate leaves
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

/** A tapered limb from a to b. */
function limb(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: string) {
  const len = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), flat(color))
  mesh.position.copy(a).lerp(b, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.add(mesh)
  return mesh
}

const B: Record<string, Builder> = {
  sofa(s, c) {
    const g = new THREE.Group()
    const arm = Math.min(0.18, s.w * 0.12)
    const seatH = s.h * 0.5
    legs(g, s, 0.08, c.legs ?? '#3f3f46', 0.08)
    box(g, s.w, seatH - 0.08, s.d, c.fabric, 0, 0.08, 0) // base + seat cushion
    box(g, s.w - 2 * arm, s.h - seatH, s.d * 0.25, c.fabric, 0, seatH, -s.d / 2 + s.d * 0.125) // back
    for (const sx of [-1, 1]) box(g, arm, s.h * 0.72 - 0.08, s.d, c.fabric, sx * (s.w / 2 - arm / 2), 0.08, 0)
    const seats = Math.max(1, Math.round((s.w - 2 * arm) / 0.65))
    const cw = (s.w - 2 * arm) / seats
    for (let i = 0; i < seats; i++) box(g, cw - 0.02, 0.1, s.d * 0.7, m(c.fabric, { rough: 1 }), -s.w / 2 + arm + cw * (i + 0.5), seatH, s.d * 0.12)
    return g
  },
  table(s, c, p) {
    const g = new THREE.Group()
    const top = 0.04
    box(g, s.w, top, s.d, c.top ?? c.wood, 0, s.h - top, 0)
    legs(g, s, s.h - top, c.legs ?? c.wood, 0.06, 0.03)
    if (p.drawer) box(g, s.w * 0.35, 0.14, s.d * 0.85, c.wood, s.w * 0.28, s.h - top - 0.14, 0)
    const n = Number(p.chairs ?? 0)
    if (n) {
      // chairs tucked around the table (part of the same item)
      const per = Math.floor(n / 2)
      for (let i = 0; i < per; i++)
        for (const side of [-1, 1]) {
          const ch = B.chair({ w: 0.44, d: 0.48, h: 0.88 }, c, {})
          ch.position.set(-s.w / 2 + (s.w / per) * (i + 0.5), 0, side * (s.d / 2 + 0.12))
          ch.rotation.y = side > 0 ? Math.PI : 0
          g.add(ch)
        }
    }
    return g
  },
  chair(s, c) {
    const g = new THREE.Group()
    const seat = 0.46
    legs(g, s, seat - 0.04, c.legs ?? c.wood, 0.04, 0.018)
    box(g, s.w, 0.04, s.d, c.wood, 0, seat - 0.04, 0)
    box(g, s.w, s.h - seat, 0.03, c.wood, 0, seat, -s.d / 2 + 0.03)
    return g
  },
  officeChair(s, c) {
    const g = new THREE.Group()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const leg = box(g, 0.04, 0.04, s.w / 2, '#27272a', (Math.sin(a) * s.w) / 4, 0.04, (Math.cos(a) * s.w) / 4)
      leg.rotation.y = a
    }
    cyl(g, 0.03, 0.03, 0.4, '#71717a', 0, 0.08, 0, 8)
    box(g, s.w * 0.85, 0.08, s.d * 0.8, c.fabric, 0, 0.48, 0.03)
    box(g, s.w * 0.8, s.h - 0.62, 0.07, c.fabric, 0, 0.62, -s.d / 2 + 0.08)
    return g
  },
  bed(s, c) {
    const g = new THREE.Group()
    box(g, s.w, 0.3, s.d, c.frame, 0, 0.05, 0)
    legs(g, s, 0.05, c.frame, 0.05, 0.03)
    box(g, s.w - 0.06, 0.22, s.d - 0.08, c.sheet, 0, 0.35, 0.02)
    box(g, s.w - 0.04, 0.05, s.d * 0.62, c.blanket, 0, 0.55, s.d * 0.19)
    box(g, s.w, s.h - 0.05, 0.08, c.frame, 0, 0.05, -s.d / 2 + 0.04) // headboard at the back
    const pillows = s.w > 1.2 ? 2 : 1
    for (let i = 0; i < pillows; i++) box(g, s.w / pillows - 0.12, 0.12, 0.35, c.sheet, -s.w / 2 + (s.w / pillows) * (i + 0.5), 0.57, -s.d / 2 + 0.3)
    return g
  },
  cabinet(s, c, p) {
    if (p.tv) {
      // low media unit (0.5 m) with a screen on top filling the rest of the declared height
      const g = B.cabinet({ ...s, h: 0.5 }, c, { ...p, tv: false })
      box(g, s.w * 0.4, 0.04, 0.2, '#27272a', 0, 0.5, -0.05)
      const sw = Math.min(s.w * 0.75, ((s.h - 0.56) / 0.56) * 1)
      box(g, sw, s.h - 0.56, 0.04, m('#111113', { rough: 0.3 }), 0, 0.54, -0.05)
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
    box(g, s.w, s.h, s.d, m(c.fabric, { rough: 1 }))
    box(g, s.w - 0.2, s.h + 0.001, s.d - 0.2, m(new THREE.Color(c.fabric).offsetHSL(0, 0, 0.12).getStyle(), { rough: 1 }))
    return g
  },
  appliance(s, c, p) {
    const g = new THREE.Group()
    box(g, s.w, s.h, s.d, m(c.body, { rough: 0.35 }))
    if (p.kind === 'fridge') {
      box(g, s.w - 0.01, 0.008, 0.005, c.trim, 0, s.h * 0.62, s.d / 2 + 0.002)
      for (const [y, h] of [[s.h * 0.7, 0.3], [s.h * 0.3, 0.4]]) box(g, 0.02, h, 0.03, c.trim, s.w / 2 - 0.06, y, s.d / 2 + 0.015)
    } else {
      box(g, s.w, 0.01, s.d, '#18181b', 0, s.h, 0)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.08, 0.08, 0.012, '#3f3f46', sx * s.w * 0.22, s.h, sz * s.d * 0.22)
      box(g, s.w * 0.8, s.h * 0.45, 0.01, m('#18181b', { rough: 0.2 }), 0, s.h * 0.2, s.d / 2 + 0.003)
      box(g, s.w * 0.7, 0.025, 0.03, c.trim, 0, s.h * 0.7, s.d / 2 + 0.02)
    }
    return g
  },
  toilet(s, c) {
    const g = new THREE.Group()
    box(g, s.w * 0.55, 0.38, s.d * 0.5, c.ceramic, 0, 0, s.d * 0.05)
    const bowl = cyl(g, s.w / 2, s.w * 0.35, 0.08, c.ceramic, 0, 0.36, s.d * 0.12)
    bowl.scale.z = 1.3
    box(g, s.w, 0.38, 0.18, c.ceramic, 0, 0.42, -s.d / 2 + 0.09)
    return g
  },
  basin(s, c) {
    const g = new THREE.Group()
    box(g, s.w, s.h - 0.15, s.d, c.wood ?? '#b8915f', 0, 0, 0)
    box(g, s.w, 0.15, s.d, c.ceramic, 0, s.h - 0.15, 0)
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
  lamp(s, c, p) {
    const g = new THREE.Group()
    const shade = m(c.shade, { rough: 1 })
    if (p.pendant) {
      // hangs down from the item's top (placed at the ceiling)
      cyl(g, 0.005, 0.005, s.h * 0.6, c.metal, 0, s.h * 0.4, 0, 6)
      cyl(g, 0.06, s.w / 2, s.h * 0.4, shade)
    } else if (p.bollard) {
      cyl(g, s.w * 0.3, s.w * 0.35, s.h * 0.8, c.metal)
      cyl(g, s.w * 0.4, s.w * 0.4, s.h * 0.15, shade, 0, s.h * 0.8, 0)
      cyl(g, s.w * 0.45, s.w * 0.45, s.h * 0.05, c.metal, 0, s.h * 0.95, 0)
    } else {
      cyl(g, s.w * 0.35, s.w * 0.4, 0.03, c.metal)
      cyl(g, 0.012, 0.012, s.h * 0.8, c.metal, 0, 0.03, 0, 8)
      cyl(g, s.w * 0.3, s.w / 2, s.h * 0.2, shade, 0, s.h * 0.8, 0)
    }
    return g
  },
  plant(s, c) {
    // potted leafy plant: tapered pot with a rim, soil, arching stems ending in leaves
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
  tree(s, c, p) {
    // deciduous (or birch): branching trunk under a crown of 9–12 leaf clumps
    const g = new THREE.Group()
    const rand = rng(Number(p.seed ?? 1))
    const birch = !!p.birch
    const R = s.w * (birch ? 0.3 : 0.34) // crown radius
    const crownY = s.h - R * (birch ? 1.25 : 0.95)
    const trunkTop = crownY - R * 0.1 // the trunk runs up into the crown
    const r0 = s.w * (birch ? 0.03 : 0.045)
    const bark = birch ? '#e9e6df' : c.trunk
    const lean = new THREE.Vector3((rand() - 0.5) * s.w * 0.05, trunkTop, (rand() - 0.5) * s.w * 0.05)
    limb(g, new THREE.Vector3(0, 0, 0), lean, r0, r0 * 0.7, bark)
    if (birch) for (let i = 0; i < 7; i++) box(g, r0 * 2.05, 0.03, r0 * 0.9, '#3f3f46', 0, 0.3 + i * (trunkTop / 8) + rand() * 0.1, r0 * 0.6 * (rand() - 0.5))
    // Crown: a dome of clumps; bigger trees get more, smaller clumps (and finer ones) rather than a few huge ones.
    const detail = R > 0.9 ? 2 : 1
    const clumps: [number, number, number, number][] = [[0, crownY + R * 0.3, 0, R * 0.62]]
    const n = 8 + Math.round(R * 5)
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + rand() * 0.3 // golden-angle spiral: even coverage
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
    // stacked, ragged cones on a short trunk
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
    // curved ringed trunk, drooping fronds, a few coconuts
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
        pos.setZ(j, -((x / len) ** 2) * len * 0.55) // droop
      }
      geo.computeVertexNormals()
      const frond = new THREE.Mesh(geo, frondMat(c.leaf))
      frond.position.copy(top)
      frond.rotation.set(-Math.PI / 2, 0, (i / 10) * Math.PI * 2)
      frond.rotateY(-0.35) // lift the frond before it droops
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
    // a clipped row: a box core under overlapping clumps
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
    cyl(g, 0.25, 0.25, 0.06, c.metal)
    cyl(g, 0.02, 0.02, s.h - 0.1, c.metal, 0, 0.06, 0, 8)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(s.w / 2, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ color: c.canvas, side: THREE.DoubleSide }))
    canopy.position.y = s.h - 0.3
    g.add(canopy)
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
