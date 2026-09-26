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
  plant(s, c) {
    const g = new THREE.Group()
    const potH = s.h * 0.3
    cyl(g, s.w * 0.32, s.w * 0.25, potH, c.pot)
    cyl(g, 0.015, 0.015, s.h * 0.4, c.trunk, 0, potH, 0, 6)
    ball(g, s.w * 0.45, c.leaf, 0, s.h - s.w * 0.45, 0, 1.1)
    ball(g, s.w * 0.3, c.leaf, s.w * 0.15, s.h * 0.62, s.w * 0.1)
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
  tree(s, c) {
    const g = new THREE.Group()
    const r = s.w / 2
    cyl(g, r * 0.06, r * 0.1, s.h * 0.5, c.trunk, 0, 0, 0, 10)
    ball(g, r * 0.8, c.leaf, 0, s.h - r * 0.9, 0, 1.15)
    ball(g, r * 0.6, new THREE.Color(c.leaf).offsetHSL(0, 0, 0.05).getStyle(), r * 0.35, s.h - r * 1.3, r * 0.2)
    ball(g, r * 0.55, new THREE.Color(c.leaf).offsetHSL(0, 0, -0.05).getStyle(), -r * 0.35, s.h - r * 1.25, -r * 0.2)
    return g
  },
  bush(s, c) {
    const g = new THREE.Group()
    const r = s.w / 2
    ball(g, r * 0.7, c.leaf, 0, s.h * 0.5, 0, s.h / s.w + 0.3)
    ball(g, r * 0.5, new THREE.Color(c.leaf).offsetHSL(0, 0, 0.06).getStyle(), r * 0.45, s.h * 0.4, r * 0.1)
    ball(g, r * 0.5, new THREE.Color(c.leaf).offsetHSL(0, 0, -0.04).getStyle(), -r * 0.4, s.h * 0.38, -r * 0.15)
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
