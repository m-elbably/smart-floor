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

export const ROOM_KINDS = [
  'generic',
  'living',
  'bedroom',
  'kitchen',
  'bathroom',
  'dining',
  'office',
  'hallway',
  'garage',
  'storage',
  'outdoor'
] as const

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

export interface RoomTemplateItem {
  catalogId: string
  at: Vec2
  rotation: number
  z?: number
  scale?: [number, number, number]
  variant?: string | null
  name?: string | null
}

export interface RoomTemplate {
  id?: string
  label: string
  icon: string
  kind: string
  name: string
  floorMaterial: string
  wallColor?: string
  polygon: Vec2[] // CCW, origin at the stamp's centre
  /** Default furniture, positions relative to the stamp's centre (rotation in degrees, 0 = front faces −y). */
  items?: RoomTemplateItem[]
  custom?: boolean
  createdAt?: number
}

const rect = (w: number, d: number): Vec2[] => [
  [-w / 2, -d / 2],
  [w / 2, -d / 2],
  [w / 2, d / 2],
  [-w / 2, d / 2]
]

export const TEMPLATES: Record<string, RoomTemplate> = {
  // Generic / Default
  rect: {
    id: 'rect',
    label: 'Rectangle 4 × 3 m',
    icon: 'i-lucide-rectangle-horizontal',
    kind: 'generic',
    name: 'Room',
    floorMaterial: 'wood',
    polygon: rect(4, 3)
  },

  // ===================== LIVING ROOMS =====================
  lshape: {
    id: 'lshape',
    label: 'L-shape Living 6 × 6 m',
    icon: 'i-lucide-square-dashed-bottom',
    kind: 'living',
    name: 'Living',
    floorMaterial: 'wood',
    wallColor: '#f2eee9',
    polygon: [
      [-3, -3],
      [3, -3],
      [3, 0],
      [0, 0],
      [0, 3],
      [-3, 3]
    ],
    items: [
      { catalogId: 'rug', at: [-1.5, 0.6], rotation: 0, scale: [0.8, 0.8, 1] },
      { catalogId: 'sofa-l', at: [-1.45, 1.85], rotation: 0 },
      { catalogId: 'coffee-table-round', at: [-1.5, 0.6], rotation: 0 },
      { catalogId: 'media-wall', at: [-1.5, -2.7], rotation: 180 },
      { catalogId: 'armchair', at: [1.8, -1.8], rotation: 90 },
      { catalogId: 'plant-monstera', at: [2.5, -0.5], rotation: 0 },
      { catalogId: 'floor-lamp', at: [-2.6, 2.6], rotation: 0 }
    ]
  },

  'living-modern': {
    id: 'living-modern',
    label: 'Modern Lounge 5.5 × 4.5 m',
    icon: 'i-lucide-sofa',
    kind: 'living',
    name: 'Modern Living',
    floorMaterial: 'wood',
    wallColor: '#f3efe9',
    polygon: rect(5.5, 4.5),
    items: [
      { catalogId: 'rug', at: [0, 0.1], rotation: 0 },
      { catalogId: 'sofa-l', at: [0, 1.25], rotation: 0 },
      { catalogId: 'coffee-table-round', at: [0, 0.1], rotation: 0 },
      { catalogId: 'media-wall', at: [0, -1.95], rotation: 180 },
      { catalogId: 'armchair', at: [1.8, 0.1], rotation: 90 },
      { catalogId: 'side-table', at: [-1.7, 1.25], rotation: 0 },
      { catalogId: 'floor-lamp', at: [-2.3, 1.8], rotation: 0 },
      { catalogId: 'plant-monstera', at: [2.2, -1.7], rotation: 0 }
    ]
  },

  'great-room': {
    id: 'great-room',
    label: 'Open Living & Dining 8 × 5 m',
    icon: 'i-lucide-layout-grid',
    kind: 'living',
    name: 'Great Room',
    floorMaterial: 'wood',
    wallColor: '#f5f3ee',
    polygon: rect(8, 5),
    items: [
      // Living Zone (Left)
      { catalogId: 'rug', at: [-2.0, 0.1], rotation: 0 },
      { catalogId: 'sofa-l', at: [-2.0, 1.45], rotation: 0 },
      { catalogId: 'coffee-table', at: [-2.0, 0.2], rotation: 0 },
      { catalogId: 'media-wall', at: [-2.0, -2.2], rotation: 180 },
      { catalogId: 'armchair', at: [-0.4, 0.2], rotation: 90 },
      { catalogId: 'floor-lamp', at: [-3.4, 1.8], rotation: 0 },
      { catalogId: 'plant-fig', at: [-3.4, -1.9], rotation: 0 },
      // Dining Zone (Right)
      { catalogId: 'dining-6', at: [2.2, 0.1], rotation: 0 },
      { catalogId: 'chandelier', at: [2.2, 0.1], rotation: 0 },
      { catalogId: 'sideboard', at: [2.2, -2.2], rotation: 180 },
      { catalogId: 'wall-art', at: [2.2, 2.42], rotation: 0 }
    ]
  },

  'living-hearth': {
    id: 'living-hearth',
    label: 'Cozy Hearth Lounge 5 × 4 m',
    icon: 'i-lucide-flame',
    kind: 'living',
    name: 'Hearth Lounge',
    floorMaterial: 'wood',
    wallColor: '#ede8e1',
    polygon: rect(5, 4),
    items: [
      { catalogId: 'fireplace', at: [0, -1.75], rotation: 180 },
      { catalogId: 'rug', at: [0, 0.2], rotation: 0 },
      { catalogId: 'sofa-3', at: [0, 1.35], rotation: 0 },
      { catalogId: 'coffee-table', at: [0, -0.1], rotation: 0 },
      { catalogId: 'armchair', at: [-1.7, -0.1], rotation: 270 },
      { catalogId: 'armchair', at: [1.7, -0.1], rotation: 90 },
      { catalogId: 'bookshelf', at: [-1.8, 1.75], rotation: 0 },
      { catalogId: 'floor-lamp', at: [2.0, 1.4], rotation: 0 },
      { catalogId: 'pouf', at: [-0.8, -1.1], rotation: 0 }
    ]
  },

  // ===================== BEDROOMS =====================
  bedroom: {
    id: 'bedroom',
    label: 'Bedroom 4 × 3.5 m',
    icon: 'i-lucide-bed-double',
    kind: 'bedroom',
    name: 'Bedroom',
    floorMaterial: 'carpet',
    wallColor: '#f0ede6',
    polygon: rect(4, 3.5),
    items: [
      { catalogId: 'bed-double', at: [0, 0.65], rotation: 0 },
      { catalogId: 'nightstand', at: [-1.15, 1.50], rotation: 0 },
      { catalogId: 'nightstand', at: [1.15, 1.50], rotation: 0 },
      { catalogId: 'wardrobe', at: [1.15, -1.40], rotation: 180 }
    ]
  },

  'bedroom-master': {
    id: 'bedroom-master',
    label: 'Master Suite 6 × 4.8 m',
    icon: 'i-lucide-crown',
    kind: 'bedroom',
    name: 'Master Suite',
    floorMaterial: 'carpet',
    wallColor: '#eae6df',
    polygon: [
      [-3, -2.4],
      [3, -2.4],
      [3, 0.8],
      [1, 0.8],
      [1, 2.4],
      [-3, 2.4]
    ],
    items: [
      // Sleeping Area
      { catalogId: 'bed-king', at: [-1.0, 1.25], rotation: 0 },
      { catalogId: 'nightstand', at: [-2.35, 2.15], rotation: 0 },
      { catalogId: 'nightstand', at: [0.35, 2.15], rotation: 0 },
      { catalogId: 'rug', at: [-1.0, 0.4], rotation: 0 },
      { catalogId: 'dresser', at: [-1.0, -2.1], rotation: 180 },
      { catalogId: 'armchair', at: [-2.2, -1.4], rotation: 90 },
      { catalogId: 'plant-monstera', at: [-2.4, 0.2], rotation: 0 },
      // Dressing Nook
      { catalogId: 'wardrobe', at: [2.0, -2.05], rotation: 180 },
      { catalogId: 'vanity-table', at: [2.0, 0.525], rotation: 0 },
      { catalogId: 'floor-mirror', at: [2.75, -0.7], rotation: 90 }
    ]
  },

  'bedroom-kids': {
    id: 'bedroom-kids',
    label: 'Kids / Shared Bedroom 4.2 × 3.5 m',
    icon: 'i-lucide-baby',
    kind: 'bedroom',
    name: 'Kids Bedroom',
    floorMaterial: 'wood',
    wallColor: '#e8eff2',
    polygon: rect(4.2, 3.5),
    items: [
      { catalogId: 'bed-bunk', at: [-1.45, 0.65], rotation: 0 },
      { catalogId: 'wardrobe', at: [-1.2, -1.40], rotation: 180 },
      { catalogId: 'desk', at: [1.2, 1.35], rotation: 0 },
      { catalogId: 'office-chair', at: [1.2, 0.75], rotation: 0 },
      { catalogId: 'desk', at: [1.2, -1.35], rotation: 180 },
      { catalogId: 'office-chair', at: [1.2, -0.75], rotation: 180 },
      { catalogId: 'bookshelf', at: [1.875, 0], rotation: 90 },
      { catalogId: 'rug', at: [-0.1, 0], rotation: 0, scale: [0.8, 0.8, 1] }
    ]
  },

  'studio-suite': {
    id: 'studio-suite',
    label: 'Studio Apartment 6.5 × 5 m',
    icon: 'i-lucide-home',
    kind: 'living',
    name: 'Studio Apartment',
    floorMaterial: 'laminate',
    wallColor: '#f3efe8',
    polygon: [
      [-3.25, -2.5],
      [3.25, -2.5],
      [3.25, 0.8],
      [0.5, 0.8],
      [0.5, 2.5],
      [-3.25, 2.5]
    ],
    items: [
      // Sleeping Corner
      { catalogId: 'bed-double', at: [-1.8, 1.35], rotation: 0 },
      { catalogId: 'nightstand', at: [-2.85, 2.25], rotation: 0 },
      { catalogId: 'wardrobe', at: [-2.9, -0.2], rotation: 270 },
      // Living Area
      { catalogId: 'sofa-2', at: [1.8, 0.25], rotation: 0 },
      { catalogId: 'coffee-table', at: [1.8, -0.5], rotation: 0 },
      { catalogId: 'tv-unit', at: [1.8, -2.225], rotation: 180 },
      { catalogId: 'rug', at: [1.6, -0.5], rotation: 0, scale: [0.8, 0.8, 1] },
      // Kitchenette
      { catalogId: 'counter', at: [-0.8, -2.14], rotation: 180 },
      { catalogId: 'fridge', at: [-2.5, -2.125], rotation: 180 },
      { catalogId: 'dining-4', at: [-0.2, -0.8], rotation: 0 }
    ]
  },

  // ===================== KITCHEN & DINING =====================
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen 3.5 × 3 m',
    icon: 'i-lucide-cooking-pot',
    kind: 'kitchen',
    name: 'Kitchen',
    floorMaterial: 'tile',
    wallColor: '#f6f6f4',
    polygon: rect(3.5, 3),
    items: [
      { catalogId: 'counter', at: [-0.4, 1.14], rotation: 0 },
      { catalogId: 'fridge', at: [1.35, 1.125], rotation: 0 },
      { catalogId: 'dining-4', at: [0, -0.5], rotation: 0 }
    ]
  },

  'kitchen-island': {
    id: 'kitchen-island',
    label: "Chef's Island Kitchen 5 × 4 m",
    icon: 'i-lucide-utensils-crossed',
    kind: 'kitchen',
    name: 'Island Kitchen',
    floorMaterial: 'tile',
    wallColor: '#f5f5f3',
    polygon: rect(5, 4),
    items: [
      { catalogId: 'counter', at: [-0.1, 1.64], rotation: 0 },
      { catalogId: 'stove', at: [1.5, 1.64], rotation: 0 },
      { catalogId: 'range-hood', at: [1.5, 1.70], rotation: 0 },
      { catalogId: 'kitchen-sink', at: [-1.8, 1.64], rotation: 0 },
      { catalogId: 'wall-cabinets', at: [-0.1, 1.775], rotation: 0 },
      { catalogId: 'fridge-double', at: [2.075, 0.8], rotation: 90 },
      { catalogId: 'dishwasher', at: [-1.8, -1.64], rotation: 180 },
      { catalogId: 'kitchen-island', at: [0, -0.3], rotation: 0 }
    ]
  },

  'kitchen-dining': {
    id: 'kitchen-dining',
    label: 'Eat-In Kitchen 4.5 × 3.6 m',
    icon: 'i-lucide-cooking-pot',
    kind: 'kitchen',
    name: 'Eat-In Kitchen',
    floorMaterial: 'tile',
    wallColor: '#f4f2ec',
    polygon: rect(4.5, 3.6),
    items: [
      { catalogId: 'counter', at: [-0.7, 1.44], rotation: 0 },
      { catalogId: 'fridge', at: [0.9, 1.425], rotation: 0 },
      { catalogId: 'stove', at: [1.6, 1.44], rotation: 0 },
      { catalogId: 'dining-round', at: [-0.4, -0.5], rotation: 0 },
      { catalogId: 'pendant', at: [-0.4, -0.5], rotation: 0 }
    ]
  },

  'dining-formal': {
    id: 'dining-formal',
    label: 'Formal Dining Room 4.8 × 3.8 m',
    icon: 'i-lucide-utensils',
    kind: 'dining',
    name: 'Dining Room',
    floorMaterial: 'wood',
    wallColor: '#ebe6dc',
    polygon: rect(4.8, 3.8),
    items: [
      { catalogId: 'dining-6', at: [0, 0], rotation: 0 },
      { catalogId: 'chandelier', at: [0, 0], rotation: 0 },
      { catalogId: 'rug', at: [0, 0], rotation: 0 },
      { catalogId: 'sideboard', at: [0, 1.625], rotation: 0 },
      { catalogId: 'wall-art', at: [0, -1.825], rotation: 180 },
      { catalogId: 'plant-fig', at: [-1.8, 1.3], rotation: 0 },
      { catalogId: 'plant-monstera', at: [1.8, 1.3], rotation: 0 }
    ]
  },

  // ===================== BATHROOMS =====================
  bathroom: {
    id: 'bathroom',
    label: 'Bathroom 2.5 × 2 m',
    icon: 'i-lucide-bath',
    kind: 'bathroom',
    name: 'Bathroom',
    floorMaterial: 'tile',
    wallColor: '#f7f7f5',
    polygon: rect(2.5, 2),
    items: [
      { catalogId: 'toilet', at: [-0.8, 0.61], rotation: 0 },
      { catalogId: 'basin', at: [0.05, 0.71], rotation: 0 },
      { catalogId: 'bathtub', at: [0.35, -0.575], rotation: 180 }
    ]
  },

  'bathroom-spa': {
    id: 'bathroom-spa',
    label: 'Luxury Spa Bathroom 3.8 × 3.2 m',
    icon: 'i-lucide-sparkles',
    kind: 'bathroom',
    name: 'Spa Bathroom',
    floorMaterial: 'marble',
    wallColor: '#ece9e4',
    polygon: rect(3.8, 3.2),
    items: [
      { catalogId: 'freestanding-tub', at: [-0.85, 0.95], rotation: 0 },
      { catalogId: 'walkin-shower', at: [1.40, 0.55], rotation: 90 },
      { catalogId: 'double-vanity', at: [-0.85, -1.29], rotation: 180 },
      { catalogId: 'toilet', at: [1.4, -1.21], rotation: 180 },
      { catalogId: 'towel-radiator', at: [1.79, -0.4], rotation: 90 },
      { catalogId: 'plant', at: [-1.6, 1.2], rotation: 0 }
    ]
  },

  'powder-room': {
    id: 'powder-room',
    label: 'Powder Room 1.8 × 1.5 m',
    icon: 'i-lucide-bath',
    kind: 'bathroom',
    name: 'Powder Room',
    floorMaterial: 'tile',
    wallColor: '#f2ede6',
    polygon: rect(1.8, 1.5),
    items: [
      { catalogId: 'toilet', at: [-0.45, 0.36], rotation: 0 },
      { catalogId: 'basin', at: [0.35, 0.46], rotation: 0 },
      { catalogId: 'towel-radiator', at: [0.79, -0.1], rotation: 90 }
    ]
  },

  // ===================== OFFICE & STUDY =====================
  'office-executive': {
    id: 'office-executive',
    label: 'Executive Corner Office 4.8 × 3.8 m',
    icon: 'i-lucide-briefcase',
    kind: 'office',
    name: 'Executive Office',
    floorMaterial: 'wood',
    wallColor: '#eae6df',
    polygon: rect(4.8, 3.8),
    items: [
      { catalogId: 'desk-l', at: [-0.9, 0.7], rotation: 0 },
      { catalogId: 'office-chair', at: [-0.9, 1.3], rotation: 0 },
      { catalogId: 'chair', at: [-1.4, -0.1], rotation: 180 },
      { catalogId: 'chair', at: [-0.4, -0.1], rotation: 180 },
      { catalogId: 'office-bookshelf', at: [1.5, 1.65], rotation: 0 },
      { catalogId: 'sideboard', at: [2.125, 0], rotation: 90 },
      { catalogId: 'plant-monstera', at: [1.9, -1.4], rotation: 0 },
      { catalogId: 'floor-lamp', at: [-2.0, 1.4], rotation: 0 },
      { catalogId: 'rug', at: [-0.9, 0.5], rotation: 0 }
    ]
  },

  'office-study': {
    id: 'office-study',
    label: 'Home Study & Library 3.6 × 3.0 m',
    icon: 'i-lucide-book-open',
    kind: 'office',
    name: 'Study Room',
    floorMaterial: 'wood',
    wallColor: '#eee9df',
    polygon: rect(3.6, 3.0),
    items: [
      { catalogId: 'desk', at: [-0.8, 1.10], rotation: 0 },
      { catalogId: 'office-chair', at: [-0.8, 0.5], rotation: 0 },
      { catalogId: 'bookshelf', at: [1.0, 1.275], rotation: 0 },
      { catalogId: 'bookshelf', at: [1.575, 0.1], rotation: 90 },
      { catalogId: 'armchair', at: [1.0, -0.9], rotation: 180 },
      { catalogId: 'floor-lamp', at: [1.5, -1.1], rotation: 0 },
      { catalogId: 'rug', at: [-0.2, -0.2], rotation: 0 }
    ]
  },

  'conference-room': {
    id: 'conference-room',
    label: 'Conference Room 6 × 4 m',
    icon: 'i-lucide-users',
    kind: 'office',
    name: 'Conference Room',
    floorMaterial: 'carpet',
    wallColor: '#f0ede6',
    polygon: rect(6, 4),
    items: [
      { catalogId: 'meeting-table', at: [0, 0], rotation: 0 },
      { catalogId: 'tv-unit', at: [0, -1.725], rotation: 180 },
      { catalogId: 'sideboard', at: [0, 1.725], rotation: 0 },
      { catalogId: 'plant-fig', at: [-2.4, 1.4], rotation: 0 },
      { catalogId: 'plant-monstera', at: [2.4, 1.4], rotation: 0 }
    ]
  },

  // ===================== ENTRYWAY, CLOSET, GARAGE =====================
  'entryway-foyer': {
    id: 'entryway-foyer',
    label: 'Entryway Foyer 3.2 × 2.2 m',
    icon: 'i-lucide-footprints',
    kind: 'hallway',
    name: 'Entry Foyer',
    floorMaterial: 'tile',
    wallColor: '#f2ede4',
    polygon: rect(3.2, 2.2),
    items: [
      { catalogId: 'console-table', at: [0, 0.86], rotation: 0 },
      { catalogId: 'wall-sconce', at: [-0.7, 0.99], rotation: 0 },
      { catalogId: 'wall-sconce', at: [0.7, 0.99], rotation: 0 },
      { catalogId: 'floor-mirror', at: [-1.35, 0], rotation: 270 },
      { catalogId: 'wardrobe', at: [0.7, -0.75], rotation: 180 },
      { catalogId: 'bench', at: [-0.65, -0.75], rotation: 180 }
    ]
  },

  'walkin-closet': {
    id: 'walkin-closet',
    label: 'Walk-in Dressing Room 3.2 × 2.6 m',
    icon: 'i-lucide-archive',
    kind: 'storage',
    name: 'Walk-in Closet',
    floorMaterial: 'wood',
    wallColor: '#f4f2ee',
    polygon: rect(3.2, 2.6),
    items: [
      { catalogId: 'wardrobe-large', at: [0, 0.94], rotation: 0 },
      { catalogId: 'wardrobe', at: [-1.25, -0.3], rotation: 270 },
      { catalogId: 'dresser', at: [1.30, -0.3], rotation: 90 },
      { catalogId: 'pouf', at: [0, -0.2], rotation: 0 },
      { catalogId: 'floor-mirror', at: [0, -1.05], rotation: 180 }
    ]
  },

  'garage-workshop': {
    id: 'garage-workshop',
    label: 'Double Garage & Workshop 6 × 6 m',
    icon: 'i-lucide-car',
    kind: 'garage',
    name: 'Garage & Workshop',
    floorMaterial: 'concrete',
    wallColor: '#dbdad6',
    polygon: rect(6, 6),
    items: [
      { catalogId: 'desk-executive', at: [-1.8, 2.525], rotation: 0 },
      { catalogId: 'filing-cabinet', at: [-0.5, 2.65], rotation: 0 },
      { catalogId: 'bookshelf', at: [1.2, 2.775], rotation: 0 },
      { catalogId: 'bookshelf', at: [2.2, 2.775], rotation: 0 },
      { catalogId: 'bench', at: [-2.65, 0], rotation: 270 }
    ]
  },

  // ===================== OUTDOOR & TERRACE =====================
  'patio-terrace': {
    id: 'patio-terrace',
    label: 'Garden Terrace & Patio 7 × 5 m',
    icon: 'i-lucide-trees',
    kind: 'outdoor',
    name: 'Garden Patio',
    floorMaterial: 'concrete',
    wallColor: '#e8e5dc',
    polygon: rect(7, 5),
    items: [
      { catalogId: 'pergola', at: [-1.7, 0.5], rotation: 0 },
      { catalogId: 'patio-set', at: [-1.7, 0.5], rotation: 0 },
      { catalogId: 'bbq-grill', at: [1.8, 2.125], rotation: 0 },
      { catalogId: 'fire-pit', at: [1.8, -0.8], rotation: 0 },
      { catalogId: 'sun-lounger', at: [0.8, 1.0], rotation: 0 },
      { catalogId: 'sun-lounger', at: [2.8, 1.0], rotation: 0 },
      { catalogId: 'flower-bed', at: [-1.7, -2.05], rotation: 180 },
      { catalogId: 'flower-bed', at: [1.8, -2.05], rotation: 180 },
      { catalogId: 'garden-lamp', at: [-3.2, 2.2], rotation: 0 },
      { catalogId: 'garden-lamp', at: [3.2, -2.2], rotation: 0 }
    ]
  }
}
