// Built-in choices: floor materials, room kinds, door/window presets, room templates.
import type { Vec2 } from '@/types'

export const FLOOR_MATERIALS: Record<string, { label: string; color: string }> = {
  wood: { label: 'Wood', color: '#c9a47c' },
  laminate: { label: 'Laminate', color: '#b99774' },
  tile: { label: 'Tile', color: '#d8dcdf' },
  marble: { label: 'Marble', color: '#ece8e1' },
  carpet: { label: 'Carpet', color: '#8f9bb3' },
  concrete: { label: 'Concrete', color: '#a9a9a9' }
}

export const ZONE_KINDS: Record<string, { label: string; color: string; icon: string }> = {
  grass: { label: 'Grass', color: '#7fb069', icon: 'i-lucide-sprout' },
  patio: { label: 'Patio', color: '#cdbba2', icon: 'i-lucide-grid-2x2' },
  path: { label: 'Path', color: '#bdb3a4', icon: 'i-lucide-footprints' },
  driveway: { label: 'Driveway', color: '#8f8f8f', icon: 'i-lucide-car' },
  pool: { label: 'Pool', color: '#4fb3d9', icon: 'i-lucide-waves' }
}
export const POOL_DEPTH = 1.5

export const ROOM_KINDS = ['generic', 'living', 'bedroom', 'kitchen', 'bathroom', 'dining', 'office', 'hallway', 'garage', 'storage'] as const

export interface OpeningPreset {
  label: string
  width: number
  height: number
  sill: number
}

export const DOOR_PRESETS: Record<string, OpeningPreset> = {
  single: { label: 'Single 90 cm', width: 0.9, height: 2.1, sill: 0 },
  narrow: { label: 'Narrow 80 cm', width: 0.8, height: 2.1, sill: 0 },
  wide: { label: 'Wide 100 cm', width: 1.0, height: 2.1, sill: 0 },
  double: { label: 'Double 160 cm', width: 1.6, height: 2.1, sill: 0 },
  opening: { label: 'Open passage 120 cm', width: 1.2, height: 2.2, sill: 0 }
}

export const WINDOW_PRESETS: Record<string, OpeningPreset> = {
  standard: { label: 'Standard 120 × 120', width: 1.2, height: 1.2, sill: 0.9 },
  small: { label: 'Small 60 × 60', width: 0.6, height: 0.6, sill: 1.5 },
  wide: { label: 'Wide 200 × 140', width: 2.0, height: 1.4, sill: 0.8 },
  french: { label: 'French door 120 × 210', width: 1.2, height: 2.1, sill: 0 }
}

export interface RoomTemplate {
  label: string
  icon: string
  kind: string
  name: string
  floorMaterial: string
  polygon: Vec2[] // CCW, origin at the stamp's centre
  /** Default furniture, positions relative to the stamp's centre (rotation in degrees, 0 = front faces −y). */
  items?: { catalogId: string; at: Vec2; rotation: number }[]
}

const rect = (w: number, d: number): Vec2[] => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]

export const TEMPLATES: Record<string, RoomTemplate> = {
  rect: { label: 'Rectangle 4 × 3 m', icon: 'i-lucide-rectangle-horizontal', kind: 'generic', name: 'Room', floorMaterial: 'wood', polygon: rect(4, 3) },
  lshape: {
    label: 'L-shape 6 × 6 m',
    icon: 'i-lucide-square-dashed-bottom',
    kind: 'living',
    name: 'Living',
    floorMaterial: 'wood',
    polygon: [[-3, -3], [3, -3], [3, 0], [0, 0], [0, 3], [-3, 3]],
    items: [
      { catalogId: 'rug', at: [-1.5, 0.3], rotation: 0 },
      { catalogId: 'sofa-3', at: [-1.5, 2.5], rotation: 0 },
      { catalogId: 'coffee-table', at: [-1.5, 0.9], rotation: 0 },
      { catalogId: 'tv-unit', at: [-1.5, -2.775], rotation: 180 },
      { catalogId: 'armchair', at: [1.8, -1.8], rotation: 90 },
      { catalogId: 'plant', at: [2.6, -0.4], rotation: 0 }
    ]
  },
  bathroom: {
    label: 'Bathroom 2.5 × 2 m',
    icon: 'i-lucide-bath',
    kind: 'bathroom',
    name: 'Bathroom',
    floorMaterial: 'tile',
    polygon: rect(2.5, 2),
    items: [
      { catalogId: 'toilet', at: [-0.85, 0.66], rotation: 0 },
      { catalogId: 'basin', at: [0.05, 0.775], rotation: 0 },
      { catalogId: 'bathtub', at: [0.4, -0.625], rotation: 180 }
    ]
  },
  kitchen: {
    label: 'Kitchen 3.5 × 3 m',
    icon: 'i-lucide-cooking-pot',
    kind: 'kitchen',
    name: 'Kitchen',
    floorMaterial: 'tile',
    polygon: rect(3.5, 3),
    items: [
      { catalogId: 'counter', at: [-0.5, 1.19], rotation: 0 },
      { catalogId: 'fridge', at: [1.4, 1.175], rotation: 0 },
      { catalogId: 'dining-4', at: [0, -0.5], rotation: 0 }
    ]
  },
  bedroom: {
    label: 'Bedroom 4 × 3.5 m',
    icon: 'i-lucide-bed-double',
    kind: 'bedroom',
    name: 'Bedroom',
    floorMaterial: 'carpet',
    polygon: rect(4, 3.5),
    items: [
      { catalogId: 'bed-double', at: [0, 0.7], rotation: 0 },
      { catalogId: 'nightstand', at: [-1.15, 1.55], rotation: 0 },
      { catalogId: 'nightstand', at: [1.15, 1.55], rotation: 0 },
      { catalogId: 'wardrobe', at: [1.15, -1.45], rotation: 180 }
    ]
  }
}
