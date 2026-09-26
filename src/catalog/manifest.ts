// The furniture catalog. Adding an item = adding one entry here (procedural builder or a GLB in
// public/models/). Nothing else needs to change: the panel, placement, inspector and scene read this list.

export type Category = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'outdoor' | 'decor'

export interface CatalogItem {
  id: string
  name: string
  category: Category
  tags: string[]
  /** Bounding box in metres: width (x), depth (y, front = −y in plan), height. */
  size: [w: number, d: number, h: number]
  /** wall: snaps to the nearest wall, back against it, facing into the room. ceiling: hangs from the ceiling. */
  placement: 'floor' | 'wall' | 'ceiling'
  scale?: { min: number; max: number }
  /** Colour slots per variant; the first variant is the default. */
  variants?: { id: string; name: string; colors: Record<string, string> }[]
  model: { type: 'procedural'; builder: string; params?: Record<string, unknown> } | { type: 'glb'; url: string }
}

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'living', label: 'Living', icon: 'i-lucide-sofa' },
  { id: 'bedroom', label: 'Bedroom', icon: 'i-lucide-bed-double' },
  { id: 'kitchen', label: 'Kitchen', icon: 'i-lucide-cooking-pot' },
  { id: 'bathroom', label: 'Bathroom', icon: 'i-lucide-bath' },
  { id: 'office', label: 'Office', icon: 'i-lucide-briefcase' },
  { id: 'decor', label: 'Decor', icon: 'i-lucide-lamp' },
  { id: 'outdoor', label: 'Outdoor', icon: 'i-lucide-trees' }
]

const fabric = [
  { id: 'grey', name: 'Grey', colors: { fabric: '#8e9196', legs: '#3f3f46' } },
  { id: 'blue', name: 'Blue', colors: { fabric: '#4f6d8f', legs: '#3f3f46' } },
  { id: 'sand', name: 'Sand', colors: { fabric: '#cbb994', legs: '#6b4f35' } },
  { id: 'green', name: 'Green', colors: { fabric: '#667d5e', legs: '#6b4f35' } }
]
const wood = [
  { id: 'oak', name: 'Oak', colors: { wood: '#b8915f', top: '#c9a877', legs: '#9c7a4f' } },
  { id: 'walnut', name: 'Walnut', colors: { wood: '#6e4b32', top: '#7c563a', legs: '#5a3d29' } },
  { id: 'white', name: 'White', colors: { wood: '#ecebe7', top: '#f4f3ef', legs: '#d9d7d1' } },
  { id: 'black', name: 'Black', colors: { wood: '#2f2f33', top: '#3a3a3f', legs: '#1f1f22' } }
]
const bedding = [
  { id: 'white', name: 'White linen', colors: { frame: '#b8915f', sheet: '#f3f1ec', blanket: '#d9d4c7' } },
  { id: 'navy', name: 'Navy', colors: { frame: '#6e4b32', sheet: '#f3f1ec', blanket: '#34465e' } },
  { id: 'sage', name: 'Sage', colors: { frame: '#ecebe7', sheet: '#f3f1ec', blanket: '#98a88b' } }
]
const ceramic = [{ id: 'white', name: 'White', colors: { ceramic: '#f7f7f5', metal: '#b4b8bd', wood: '#b8915f' } }]
const steel = [
  { id: 'steel', name: 'Steel', colors: { body: '#c9ccd1', trim: '#2f2f33' } },
  { id: 'white', name: 'White', colors: { body: '#f2f2f0', trim: '#9ca3af' } },
  { id: 'black', name: 'Black', colors: { body: '#303035', trim: '#6b7280' } }
]
const kitchen = [
  { id: 'white', name: 'White / oak top', colors: { wood: '#f1f0ec', top: '#b8915f', metal: '#9ca3af' } },
  { id: 'green', name: 'Sage / stone top', colors: { wood: '#8fa18a', top: '#d6d3cc', metal: '#9ca3af' } },
  { id: 'navy', name: 'Navy / marble top', colors: { wood: '#34465e', top: '#eeebe5', metal: '#c9ccd1' } }
]
const plants = [
  { id: 'green', name: 'Green', colors: { leaf: '#4f7942', pot: '#c2703d', trunk: '#6b4f35' } },
  { id: 'white-pot', name: 'Green, white pot', colors: { leaf: '#3f7a45', pot: '#ecebe7', trunk: '#6b4f35' } }
]
const trees = [
  { id: 'summer', name: 'Summer', colors: { leaf: '#4f8a3f', trunk: '#6b4f35' } },
  { id: 'lush', name: 'Lush', colors: { leaf: '#3a7d44', trunk: '#5a4230' } },
  { id: 'autumn', name: 'Autumn', colors: { leaf: '#c8702c', trunk: '#5a4230' } },
  { id: 'blossom', name: 'Blossom', colors: { leaf: '#f0a6c4', trunk: '#5a4230' } }
]
const evergreens = [
  { id: 'spruce', name: 'Spruce', colors: { leaf: '#2f5d3a', trunk: '#4a3626' } },
  { id: 'blue', name: 'Blue spruce', colors: { leaf: '#4c7a78', trunk: '#4a3626' } }
]

export const CATALOG: CatalogItem[] = [
  // Living
  { id: 'sofa-2', name: 'Sofa (2-seat)', category: 'living', tags: ['couch', 'seat'], size: [1.6, 0.9, 0.85], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'sofa' } },
  { id: 'sofa-3', name: 'Sofa (3-seat)', category: 'living', tags: ['couch', 'seat'], size: [2.2, 0.95, 0.85], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'sofa' } },
  { id: 'armchair', name: 'Armchair', category: 'living', tags: ['chair', 'seat'], size: [0.85, 0.85, 0.9], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'sofa' } },
  { id: 'coffee-table', name: 'Coffee table', category: 'living', tags: ['table'], size: [1.1, 0.6, 0.42], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table' } },
  { id: 'tv-unit', name: 'TV unit', category: 'living', tags: ['television', 'media', 'cabinet'], size: [1.8, 0.45, 1.3], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { doors: 3, tv: true } } },
  { id: 'bookshelf', name: 'Bookshelf', category: 'living', tags: ['books', 'storage', 'shelf'], size: [0.9, 0.35, 2.0], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'shelf' } },
  { id: 'rug', name: 'Rug 2 × 3 m', category: 'living', tags: ['carpet'], size: [3, 2, 0.01], placement: 'floor', scale: { min: 0.5, max: 2 }, variants: fabric, model: { type: 'procedural', builder: 'rug' } },
  // Bedroom
  { id: 'bed-single', name: 'Bed (single)', category: 'bedroom', tags: ['sleep'], size: [0.95, 2.05, 0.9], placement: 'wall', variants: bedding, model: { type: 'procedural', builder: 'bed' } },
  { id: 'bed-double', name: 'Bed (double)', category: 'bedroom', tags: ['sleep', 'queen', 'king'], size: [1.65, 2.1, 1.0], placement: 'wall', variants: bedding, model: { type: 'procedural', builder: 'bed' } },
  { id: 'nightstand', name: 'Nightstand', category: 'bedroom', tags: ['bedside', 'table'], size: [0.45, 0.4, 0.55], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { drawers: 2 } } },
  { id: 'wardrobe', name: 'Wardrobe', category: 'bedroom', tags: ['closet', 'storage'], size: [1.5, 0.6, 2.1], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { doors: 3 } } },
  { id: 'dresser', name: 'Dresser', category: 'bedroom', tags: ['drawers', 'storage'], size: [1.2, 0.5, 0.85], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { drawers: 4 } } },
  // Kitchen
  { id: 'counter', name: 'Kitchen counter (2.4 m)', category: 'kitchen', tags: ['worktop', 'cabinet'], size: [2.4, 0.62, 0.9], placement: 'wall', scale: { min: 0.25, max: 2 }, variants: kitchen, model: { type: 'procedural', builder: 'cabinet', params: { doors: 4, worktop: true } } },
  { id: 'fridge', name: 'Fridge', category: 'kitchen', tags: ['refrigerator', 'appliance'], size: [0.6, 0.65, 1.85], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'fridge' } } },
  { id: 'stove', name: 'Stove', category: 'kitchen', tags: ['oven', 'cooker', 'appliance'], size: [0.6, 0.62, 0.9], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'stove' } } },
  { id: 'kitchen-sink', name: 'Sink unit', category: 'kitchen', tags: ['sink', 'cabinet'], size: [0.8, 0.62, 0.9], placement: 'wall', variants: kitchen, model: { type: 'procedural', builder: 'cabinet', params: { doors: 2, worktop: true, sink: true } } },
  { id: 'dining-4', name: 'Dining table (4)', category: 'kitchen', tags: ['table', 'dining'], size: [1.4, 0.85, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { chairs: 4 } } },
  { id: 'dining-6', name: 'Dining table (6)', category: 'kitchen', tags: ['table', 'dining'], size: [1.9, 0.95, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { chairs: 6 } } },
  { id: 'chair', name: 'Chair', category: 'kitchen', tags: ['seat', 'dining'], size: [0.45, 0.5, 0.9], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'chair' } },
  // Bathroom
  { id: 'toilet', name: 'Toilet', category: 'bathroom', tags: ['wc'], size: [0.4, 0.68, 0.8], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'toilet' } },
  { id: 'basin', name: 'Washbasin', category: 'bathroom', tags: ['sink', 'vanity'], size: [0.6, 0.45, 0.85], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'basin' } },
  { id: 'bathtub', name: 'Bathtub', category: 'bathroom', tags: ['bath', 'tub'], size: [1.7, 0.75, 0.58], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'bathtub' } },
  { id: 'shower', name: 'Shower', category: 'bathroom', tags: ['cubicle'], size: [0.9, 0.9, 2.0], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'shower' } },
  // Office
  { id: 'desk', name: 'Desk', category: 'office', tags: ['table', 'work'], size: [1.4, 0.7, 0.75], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'table', params: { drawer: true } } },
  { id: 'office-chair', name: 'Office chair', category: 'office', tags: ['seat', 'swivel'], size: [0.6, 0.6, 1.1], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'officeChair' } },
  // Decor
  { id: 'plant', name: 'Potted plant', category: 'decor', tags: ['green', 'pot', 'natural'], size: [0.5, 0.5, 1.1], placement: 'floor', variants: plants, model: { type: 'procedural', builder: 'plant' } },
  { id: 'floor-lamp', name: 'Floor lamp', category: 'decor', tags: ['light'], size: [0.4, 0.4, 1.6], placement: 'floor', variants: [{ id: 'linen', name: 'Linen', colors: { shade: '#f1e7d0', metal: '#3f3f46' } }], model: { type: 'procedural', builder: 'lamp' } },
  { id: 'pendant', name: 'Pendant light', category: 'decor', tags: ['light', 'ceiling'], size: [0.45, 0.45, 0.6], placement: 'ceiling', variants: [{ id: 'black', name: 'Black', colors: { shade: '#27272a', metal: '#27272a' } }], model: { type: 'procedural', builder: 'lamp', params: { pendant: true } } },
  { id: 'planter', name: 'Planter (GLB sample)', category: 'decor', tags: ['pot', 'glb'], size: [0.6, 0.6, 0.5], placement: 'floor', model: { type: 'glb', url: './models/planter.glb' } },
  // Outdoor (tag 'natural': placed with a random turn and ±10 % size, so rows don't look cloned)
  { id: 'tree-s', name: 'Tree (small)', category: 'outdoor', tags: ['garden', 'green', 'natural', 'deciduous'], size: [2.4, 2.4, 3.4], placement: 'floor', variants: trees, model: { type: 'procedural', builder: 'tree', params: { seed: 3 } } },
  { id: 'tree-m', name: 'Tree (medium)', category: 'outdoor', tags: ['garden', 'green', 'natural', 'deciduous', 'oak'], size: [4, 4, 5.8], placement: 'floor', variants: trees, model: { type: 'procedural', builder: 'tree', params: { seed: 7 } } },
  { id: 'tree-l', name: 'Tree (large)', category: 'outdoor', tags: ['garden', 'green', 'natural', 'deciduous', 'oak'], size: [6.5, 6.5, 9], placement: 'floor', variants: trees, model: { type: 'procedural', builder: 'tree', params: { seed: 11 } } },
  { id: 'birch', name: 'Birch', category: 'outdoor', tags: ['garden', 'tree', 'natural', 'deciduous'], size: [2.6, 2.6, 7], placement: 'floor', variants: trees, model: { type: 'procedural', builder: 'tree', params: { seed: 5, birch: true } } },
  { id: 'conifer-s', name: 'Conifer (small)', category: 'outdoor', tags: ['garden', 'tree', 'natural', 'pine', 'evergreen'], size: [1.6, 1.6, 3.5], placement: 'floor', variants: evergreens, model: { type: 'procedural', builder: 'conifer', params: { seed: 2 } } },
  { id: 'conifer-l', name: 'Conifer (large)', category: 'outdoor', tags: ['garden', 'tree', 'natural', 'pine', 'evergreen'], size: [3.4, 3.4, 8.5], placement: 'floor', variants: evergreens, model: { type: 'procedural', builder: 'conifer', params: { seed: 9 } } },
  { id: 'palm', name: 'Palm tree', category: 'outdoor', tags: ['garden', 'tree', 'natural', 'tropical'], size: [4, 4, 6], placement: 'floor', variants: [{ id: 'green', name: 'Green', colors: { leaf: '#4f8a3f', trunk: '#8b6f4e' } }], model: { type: 'procedural', builder: 'palm' } },
  { id: 'bush', name: 'Bush', category: 'outdoor', tags: ['garden', 'shrub', 'green', 'natural'], size: [1.3, 1.3, 1], placement: 'floor', variants: trees, model: { type: 'procedural', builder: 'bush', params: { seed: 4 } } },
  { id: 'shrub-flowering', name: 'Flowering shrub', category: 'outdoor', tags: ['garden', 'shrub', 'flowers', 'natural'], size: [1.2, 1.2, 1.1], placement: 'floor', variants: [{ id: 'pink', name: 'Pink', colors: { leaf: '#4f8a3f', flower: '#e25d8e' } }, { id: 'white', name: 'White', colors: { leaf: '#3f7a45', flower: '#f4f4f5' } }, { id: 'yellow', name: 'Yellow', colors: { leaf: '#4f8a3f', flower: '#f2c14e' } }], model: { type: 'procedural', builder: 'bush', params: { seed: 8, flowers: true } } },
  { id: 'hedge', name: 'Hedge (2 m)', category: 'outdoor', tags: ['garden', 'shrub', 'boundary', 'natural'], size: [2, 0.7, 1.2], placement: 'floor', scale: { min: 0.5, max: 3 }, variants: trees.slice(0, 2), model: { type: 'procedural', builder: 'hedge' } },
  { id: 'flower-bed', name: 'Flower bed', category: 'outdoor', tags: ['garden', 'flowers'], size: [2, 0.8, 0.35], placement: 'floor', scale: { min: 0.5, max: 3 }, variants: plants, model: { type: 'procedural', builder: 'flowerBed' } },
  { id: 'bench', name: 'Garden bench', category: 'outdoor', tags: ['seat', 'garden'], size: [1.5, 0.6, 0.8], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'bench' } },
  { id: 'parasol', name: 'Parasol', category: 'outdoor', tags: ['umbrella', 'shade'], size: [2.5, 2.5, 2.4], placement: 'floor', variants: [{ id: 'cream', name: 'Cream', colors: { canvas: '#efe6d2', metal: '#71717a' } }, { id: 'teal', name: 'Teal', colors: { canvas: '#2f7f7a', metal: '#71717a' } }], model: { type: 'procedural', builder: 'parasol' } },
  { id: 'garden-lamp', name: 'Garden lamp', category: 'outdoor', tags: ['light', 'path'], size: [0.25, 0.25, 0.9], placement: 'floor', variants: [{ id: 'black', name: 'Black', colors: { shade: '#fef3c7', metal: '#27272a' } }], model: { type: 'procedural', builder: 'lamp', params: { bollard: true } } }
]
