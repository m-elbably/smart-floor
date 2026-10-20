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
  { id: 'green', name: 'Green', colors: { fabric: '#667d5e', legs: '#6b4f35' } },
  { id: 'terracotta', name: 'Terracotta', colors: { fabric: '#b85d43', legs: '#3f3f46' } },
  { id: 'charcoal', name: 'Charcoal', colors: { fabric: '#333338', legs: '#18181b' } }
]

const leather = [
  { id: 'cognac', name: 'Cognac', colors: { fabric: '#965a38', legs: '#27272a' } },
  { id: 'black', name: 'Black leather', colors: { fabric: '#252528', legs: '#18181b' } },
  { id: 'cream', name: 'Cream leather', colors: { fabric: '#ded8cb', legs: '#6b4f35' } }
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

const luxuryBedding = [
  { id: 'beige', name: 'Warm Beige', colors: { frame: '#8a7d70', sheet: '#f5f3ee', blanket: '#c2b8a7' } },
  { id: 'charcoal', name: 'Charcoal', colors: { frame: '#333338', sheet: '#f5f3ee', blanket: '#44444a' } },
  { id: 'terracotta', name: 'Terracotta', colors: { frame: '#5e4334', sheet: '#f5f3ee', blanket: '#9e5a41' } },
  { id: 'emerald', name: 'Emerald', colors: { frame: '#3f423d', sheet: '#f5f3ee', blanket: '#2e4d41' } }
]

const ceramic = [
  { id: 'white', name: 'White', colors: { ceramic: '#f7f7f5', metal: '#b4b8bd', wood: '#b8915f' } },
  { id: 'matte-black', name: 'Matte black', colors: { ceramic: '#27272a', metal: '#3f3f46', wood: '#5a3d29' } },
  { id: 'travertine', name: 'Travertine', colors: { ceramic: '#e5dec9', metal: '#d4af37', wood: '#6e4b32' } }
]

const marbleVanity = [
  { id: 'carrara', name: 'Carrara / Oak', colors: { wood: '#b8915f', top: '#f7f7f5', metal: '#b4b8bd' } },
  { id: 'nero', name: 'Nero / Walnut', colors: { wood: '#5a3d29', top: '#27272a', metal: '#d4af37' } },
  { id: 'slate', name: 'Slate / Black', colors: { wood: '#27272a', top: '#e4e4e7', metal: '#18181b' } }
]

const steel = [
  { id: 'steel', name: 'Stainless steel', colors: { body: '#c9ccd1', trim: '#2f2f33', metal: '#c9ccd1' } },
  { id: 'black', name: 'Matte black', colors: { body: '#303035', trim: '#6b7280', metal: '#303035' } },
  { id: 'white', name: 'White', colors: { body: '#f2f2f0', trim: '#9ca3af', metal: '#f2f2f0' } }
]

const kitchen = [
  { id: 'white', name: 'White / oak top', colors: { wood: '#f1f0ec', top: '#b8915f', metal: '#9ca3af' } },
  { id: 'green', name: 'Sage / stone top', colors: { wood: '#8fa18a', top: '#d6d3cc', metal: '#9ca3af' } },
  { id: 'navy', name: 'Navy / marble top', colors: { wood: '#34465e', top: '#eeebe5', metal: '#c9ccd1' } },
  { id: 'charcoal', name: 'Charcoal / quartz', colors: { wood: '#2b2b30', top: '#f4f3ef', metal: '#d4af37' } }
]

const outdoorWood = [
  { id: 'teak', name: 'Teak', colors: { wood: '#8b6b4a', frame: '#8b6b4a' } },
  { id: 'charcoal', name: 'Charcoal', colors: { wood: '#2f2f33', frame: '#27272a' } },
  { id: 'natural', name: 'Natural Oak', colors: { wood: '#b8915f', frame: '#b8915f' } }
]

const outdoorCanvas = [
  { id: 'cream', name: 'Cream', colors: { fabric: '#efe6d2', frame: '#8b6b4a' } },
  { id: 'charcoal', name: 'Charcoal', colors: { fabric: '#374151', frame: '#27272a' } },
  { id: 'sage', name: 'Sage', colors: { fabric: '#8fa18a', frame: '#8b6b4a' } }
]

const parasolColors = [
  { id: 'cream', name: 'Cream', colors: { canvas: '#efe6d2', metal: '#71717a' } },
  { id: 'teal', name: 'Teal', colors: { canvas: '#2f7f7a', metal: '#71717a' } },
  { id: 'charcoal', name: 'Charcoal', colors: { canvas: '#374151', metal: '#27272a' } }
]

const plants = [
  { id: 'green', name: 'Green, terracotta pot', colors: { leaf: '#4f7942', pot: '#c2703d', trunk: '#6b4f35' } },
  { id: 'white-pot', name: 'Green, white pot', colors: { leaf: '#3f7a45', pot: '#ecebe7', trunk: '#6b4f35' } },
  { id: 'black-pot', name: 'Green, black pot', colors: { leaf: '#2f5d3a', pot: '#27272a', trunk: '#5a4230' } }
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
  // ===================== LIVING ROOM =====================
  { id: 'sofa-2', name: 'Sofa (2-seat)', category: 'living', tags: ['couch', 'seat', 'living'], size: [1.6, 0.9, 0.85], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'sofa' } },
  { id: 'sofa-3', name: 'Sofa (3-seat)', category: 'living', tags: ['couch', 'seat', 'living'], size: [2.2, 0.95, 0.85], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'sofa' } },
  { id: 'sofa-l', name: 'Sectional Sofa (L-shape)', category: 'living', tags: ['couch', 'sectional', 'corner', 'l-shape', 'chaise', 'seat'], size: [2.6, 1.8, 0.85], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'sofa', params: { sectional: true } } },
  { id: 'armchair', name: 'Armchair', category: 'living', tags: ['chair', 'seat', 'lounge'], size: [0.85, 0.85, 0.9], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'chair', params: { kind: 'armchair' } } },
  { id: 'chaise-lounge', name: 'Chaise Lounge', category: 'living', tags: ['daybed', 'lounge', 'seat', 'relax'], size: [1.7, 0.8, 0.75], placement: 'floor', variants: leather, model: { type: 'procedural', builder: 'sofa', params: { chaise: true } } },
  { id: 'coffee-table', name: 'Coffee table', category: 'living', tags: ['table', 'coffee', 'living'], size: [1.1, 0.6, 0.42], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { coffee: true } } },
  { id: 'coffee-table-round', name: 'Round Coffee Table', category: 'living', tags: ['table', 'coffee', 'round', 'circle'], size: [0.9, 0.9, 0.42], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { shape: 'round', coffee: true } } },
  { id: 'side-table', name: 'Side Table', category: 'living', tags: ['table', 'end', 'accent', 'lamp'], size: [0.45, 0.45, 0.55], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { side: true } } },
  { id: 'tv-unit', name: 'TV unit', category: 'living', tags: ['television', 'media', 'cabinet', 'entertainment'], size: [1.8, 0.45, 1.3], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { doors: 3, tv: true } } },
  { id: 'media-wall', name: 'Luxury Media Wall', category: 'living', tags: ['tv', 'television', 'slats', 'acoustic', 'cinema', 'media'], size: [2.4, 0.45, 2.0], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { mediaWall: true } } },
  { id: 'bookshelf', name: 'Bookshelf', category: 'living', tags: ['books', 'storage', 'shelf', 'library'], size: [0.9, 0.35, 2.0], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'shelf' } },
  { id: 'sideboard', name: 'Sideboard Credenza', category: 'living', tags: ['credenza', 'buffet', 'storage', 'cabinet'], size: [1.6, 0.45, 0.82], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { sideboard: true } } },
  { id: 'fireplace', name: 'Modern Fireplace', category: 'living', tags: ['hearth', 'fire', 'flame', 'cozy', 'mantel'], size: [1.4, 0.35, 1.05], placement: 'wall', variants: [{ id: 'slate', name: 'Dark Slate', colors: { stone: '#3f3f46', wood: '#b8915f' } }, { id: 'white-stone', name: 'White Stone', colors: { stone: '#e4e4e7', wood: '#5a3d29' } }], model: { type: 'procedural', builder: 'fireplace' } },
  { id: 'pouf', name: 'Ottoman Pouf', category: 'living', tags: ['ottoman', 'pouf', 'stool', 'seat', 'footstool'], size: [0.55, 0.55, 0.42], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'pouf' } },
  { id: 'rug', name: 'Rug 2 × 3 m', category: 'living', tags: ['carpet', 'rug', 'mat', 'floor'], size: [3, 2, 0.01], placement: 'floor', scale: { min: 0.5, max: 2 }, variants: fabric, model: { type: 'procedural', builder: 'rug' } },

  // ===================== BEDROOM =====================
  { id: 'bed-single', name: 'Bed (single)', category: 'bedroom', tags: ['sleep', 'bed', 'single', 'twin'], size: [0.95, 2.05, 0.9], placement: 'wall', variants: bedding, model: { type: 'procedural', builder: 'bed' } },
  { id: 'bed-double', name: 'Bed (double)', category: 'bedroom', tags: ['sleep', 'bed', 'queen', 'double'], size: [1.65, 2.1, 1.0], placement: 'wall', variants: bedding, model: { type: 'procedural', builder: 'bed' } },
  { id: 'bed-king', name: 'Master King Bed', category: 'bedroom', tags: ['sleep', 'bed', 'king', 'luxury', 'master', 'bench'], size: [2.0, 2.2, 1.15], placement: 'wall', variants: luxuryBedding, model: { type: 'procedural', builder: 'bed', params: { king: true } } },
  { id: 'bed-bunk', name: 'Bunk Bed (Twin/Twin)', category: 'bedroom', tags: ['sleep', 'bed', 'bunk', 'kids', 'children', 'ladder'], size: [1.0, 2.05, 1.68], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'bed', params: { bunk: true } } },
  { id: 'nightstand', name: 'Nightstand', category: 'bedroom', tags: ['bedside', 'table', 'drawer'], size: [0.45, 0.4, 0.55], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { drawers: 2 } } },
  { id: 'wardrobe', name: 'Wardrobe (3-door)', category: 'bedroom', tags: ['closet', 'storage', 'clothes'], size: [1.5, 0.6, 2.1], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { doors: 3 } } },
  { id: 'wardrobe-large', name: 'Master Wardrobe (4-door)', category: 'bedroom', tags: ['closet', 'storage', 'mirror', 'clothes', 'dressing'], size: [2.2, 0.62, 2.2], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { doors: 4 } } },
  { id: 'dresser', name: 'Dresser (4-drawer)', category: 'bedroom', tags: ['drawers', 'storage', 'clothes', 'chest'], size: [1.2, 0.5, 0.85], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { drawers: 4 } } },
  { id: 'vanity-table', name: 'Dressing Table & Mirror', category: 'bedroom', tags: ['vanity', 'makeup', 'mirror', 'stool', 'dressing'], size: [1.1, 0.45, 1.35], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'cabinet', params: { dressingTable: true } } },
  { id: 'floor-mirror', name: 'Full-length Floor Mirror', category: 'bedroom', tags: ['mirror', 'glass', 'standing', 'dressing'], size: [0.6, 0.4, 1.65], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'floorMirror' } },

  // ===================== KITCHEN & DINING =====================
  { id: 'counter', name: 'Kitchen Counter (2.4 m)', category: 'kitchen', tags: ['worktop', 'cabinet', 'kitchen'], size: [2.4, 0.62, 0.9], placement: 'wall', scale: { min: 0.25, max: 2 }, variants: kitchen, model: { type: 'procedural', builder: 'cabinet', params: { doors: 4, worktop: true } } },
  { id: 'kitchen-island', name: 'Kitchen Island & Bar Stools', category: 'kitchen', tags: ['island', 'bar', 'counter', 'stools', 'breakfast'], size: [1.8, 0.95, 0.9], placement: 'floor', variants: kitchen, model: { type: 'procedural', builder: 'table', params: { island: true } } },
  { id: 'wall-cabinets', name: 'Upper Wall Cabinets', category: 'kitchen', tags: ['overhead', 'cupboard', 'storage', 'cabinet'], size: [2.0, 0.35, 0.7], placement: 'wall', variants: kitchen, model: { type: 'procedural', builder: 'cabinet', params: { wallCabinets: true } } },
  { id: 'fridge', name: 'Fridge', category: 'kitchen', tags: ['refrigerator', 'appliance', 'cooling'], size: [0.6, 0.65, 1.85], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'fridge' } } },
  { id: 'fridge-double', name: 'French Door Refrigerator', category: 'kitchen', tags: ['fridge', 'refrigerator', 'double', 'ice', 'appliance'], size: [0.95, 0.75, 1.9], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'fridge-double' } } },
  { id: 'stove', name: 'Stove & Oven', category: 'kitchen', tags: ['oven', 'cooker', 'range', 'appliance'], size: [0.6, 0.62, 0.9], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'stove' } } },
  { id: 'range-hood', name: 'Chimney Range Hood', category: 'kitchen', tags: ['hood', 'extractor', 'vent', 'chimney', 'appliance'], size: [0.9, 0.5, 0.85], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'range-hood' } } },
  { id: 'dishwasher', name: 'Built-in Dishwasher', category: 'kitchen', tags: ['dishwasher', 'appliance', 'cleaning', 'kitchen'], size: [0.6, 0.62, 0.85], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'appliance', params: { kind: 'dishwasher' } } },
  { id: 'kitchen-sink', name: 'Sink Unit', category: 'kitchen', tags: ['sink', 'cabinet', 'water', 'faucet'], size: [0.8, 0.62, 0.9], placement: 'wall', variants: kitchen, model: { type: 'procedural', builder: 'cabinet', params: { doors: 2, worktop: true, sink: true } } },
  { id: 'dining-4', name: 'Dining Table (4-seat)', category: 'kitchen', tags: ['table', 'dining', 'chairs', 'meal'], size: [1.4, 0.85, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { chairs: 4 } } },
  { id: 'dining-6', name: 'Dining Table (6-seat)', category: 'kitchen', tags: ['table', 'dining', 'chairs', 'meal', 'formal'], size: [1.9, 0.95, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { chairs: 6 } } },
  { id: 'dining-round', name: 'Round Dining Table (4-seat)', category: 'kitchen', tags: ['table', 'dining', 'round', 'circle', 'breakfast'], size: [1.2, 1.2, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { shape: 'round', chairs: 4 } } },
  { id: 'chair', name: 'Dining Chair', category: 'kitchen', tags: ['seat', 'dining', 'chair'], size: [0.45, 0.5, 0.9], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'chair' } },
  { id: 'bar-stool', name: 'Bar Stool', category: 'kitchen', tags: ['seat', 'bar', 'stool', 'counter', 'island'], size: [0.42, 0.42, 0.92], placement: 'floor', variants: leather, model: { type: 'procedural', builder: 'chair', params: { kind: 'barstool' } } },

  // ===================== BATHROOM =====================
  { id: 'toilet', name: 'Toilet', category: 'bathroom', tags: ['wc', 'commode', 'restroom'], size: [0.4, 0.68, 0.8], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'toilet' } },
  { id: 'basin', name: 'Washbasin Vanity', category: 'bathroom', tags: ['sink', 'vanity', 'mirror', 'faucet'], size: [0.6, 0.48, 0.85], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'basin' } },
  { id: 'double-vanity', name: 'Double Basin Vanity', category: 'bathroom', tags: ['sink', 'vanity', 'double', 'twin', 'master', 'mirror'], size: [1.5, 0.52, 0.85], placement: 'wall', variants: marbleVanity, model: { type: 'procedural', builder: 'cabinet', params: { doubleVanity: true } } },
  { id: 'bathtub', name: 'Bathtub', category: 'bathroom', tags: ['bath', 'tub', 'soak'], size: [1.7, 0.75, 0.58], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'bathtub' } },
  { id: 'freestanding-tub', name: 'Freestanding Soaking Tub', category: 'bathroom', tags: ['bath', 'tub', 'freestanding', 'oval', 'spa', 'luxury'], size: [1.7, 0.8, 0.6], placement: 'floor', variants: ceramic, model: { type: 'procedural', builder: 'freestandingTub' } },
  { id: 'shower', name: 'Shower Enclosure', category: 'bathroom', tags: ['shower', 'cubicle', 'glass'], size: [0.9, 0.9, 2.0], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'shower' } },
  { id: 'walkin-shower', name: 'Walk-in Glass Shower', category: 'bathroom', tags: ['shower', 'walkin', 'frameless', 'glass', 'rain'], size: [1.2, 0.9, 2.05], placement: 'wall', variants: ceramic, model: { type: 'procedural', builder: 'walkinShower' } },
  { id: 'towel-radiator', name: 'Heated Towel Rail', category: 'bathroom', tags: ['towel', 'radiator', 'heater', 'warmer', 'rack'], size: [0.55, 0.12, 1.2], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'towelRadiator' } },

  // ===================== OFFICE =====================
  { id: 'desk', name: 'Desk', category: 'office', tags: ['table', 'work', 'study', 'laptop'], size: [1.4, 0.7, 0.75], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'table', params: { drawer: true } } },
  { id: 'desk-l', name: 'Corner L-Shaped Desk', category: 'office', tags: ['desk', 'corner', 'l-shape', 'executive', 'work'], size: [1.8, 1.6, 0.75], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'table', params: { desk: true } } },
  { id: 'desk-executive', name: 'Executive Desk & Monitor', category: 'office', tags: ['desk', 'executive', 'computer', 'monitor', 'boss'], size: [1.8, 0.85, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { desk: true } } },
  { id: 'office-chair', name: 'Ergonomic Office Chair', category: 'office', tags: ['seat', 'swivel', 'ergonomic', 'mesh', 'desk'], size: [0.6, 0.6, 1.1], placement: 'floor', variants: fabric, model: { type: 'procedural', builder: 'officeChair' } },
  { id: 'office-bookshelf', name: 'Office File Bookshelf', category: 'office', tags: ['books', 'files', 'storage', 'cabinet'], size: [1.2, 0.4, 1.8], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'shelf' } },
  { id: 'meeting-table', name: 'Conference Table & Chairs', category: 'office', tags: ['conference', 'meeting', 'boardroom', 'office'], size: [2.4, 1.1, 0.75], placement: 'floor', variants: wood, model: { type: 'procedural', builder: 'table', params: { meeting: true } } },
  { id: 'filing-cabinet', name: 'Filing Cabinet', category: 'office', tags: ['drawers', 'storage', 'files', 'documents'], size: [0.45, 0.6, 1.1], placement: 'wall', variants: steel, model: { type: 'procedural', builder: 'cabinet', params: { drawers: 3 } } },

  // ===================== DECOR & LIGHTING =====================
  { id: 'plant', name: 'Potted Houseplant', category: 'decor', tags: ['green', 'pot', 'natural', 'indoor'], size: [0.5, 0.5, 1.1], placement: 'floor', variants: plants, model: { type: 'procedural', builder: 'plant' } },
  { id: 'plant-monstera', name: 'Monstera Deliciosa', category: 'decor', tags: ['plant', 'monstera', 'green', 'tropical', 'leaf'], size: [0.7, 0.7, 1.3], placement: 'floor', variants: plants, model: { type: 'procedural', builder: 'monstera' } },
  { id: 'plant-fig', name: 'Fiddle Leaf Fig Tree', category: 'decor', tags: ['plant', 'fig', 'tree', 'indoor', 'green'], size: [0.6, 0.6, 1.6], placement: 'floor', variants: plants, model: { type: 'procedural', builder: 'pottedTree' } },
  { id: 'floor-lamp', name: 'Floor lamp', category: 'decor', tags: ['light', 'standing', 'shade'], size: [0.4, 0.4, 1.6], placement: 'floor', variants: [{ id: 'linen', name: 'Linen', colors: { shade: '#f1e7d0', metal: '#3f3f46' } }], model: { type: 'procedural', builder: 'lamp' } },
  { id: 'pendant', name: 'Pendant light', category: 'decor', tags: ['light', 'ceiling', 'hanging'], size: [0.45, 0.45, 0.6], placement: 'ceiling', variants: [{ id: 'black', name: 'Black', colors: { shade: '#27272a', metal: '#27272a' } }, { id: 'brass', name: 'Brass', colors: { shade: '#d4af37', metal: '#d4af37' } }], model: { type: 'procedural', builder: 'lamp', params: { pendant: true } } },
  { id: 'chandelier', name: 'Modern Chandelier', category: 'decor', tags: ['light', 'ceiling', 'chandelier', 'luxury', 'dining'], size: [0.8, 0.8, 0.7], placement: 'ceiling', variants: [{ id: 'brass', name: 'Brass / Amber', colors: { metal: '#d4af37', shade: '#fef3c7' } }, { id: 'black', name: 'Matte Black', colors: { metal: '#27272a', shade: '#fef3c7' } }], model: { type: 'procedural', builder: 'lamp', params: { chandelier: true } } },
  { id: 'ceiling-fan', name: 'Ceiling Fan & Light', category: 'decor', tags: ['fan', 'ceiling', 'light', 'cooling'], size: [1.2, 1.2, 0.4], placement: 'ceiling', variants: [{ id: 'wood', name: 'Walnut / Black', colors: { metal: '#27272a', wood: '#6e4b32' } }, { id: 'white', name: 'White', colors: { metal: '#f4f3ef', wood: '#f4f3ef' } }], model: { type: 'procedural', builder: 'lamp', params: { ceilingFan: true } } },
  { id: 'wall-sconce', name: 'Architectural Wall Sconce', category: 'decor', tags: ['light', 'wall', 'sconce', 'updown'], size: [0.15, 0.12, 0.38], placement: 'wall', variants: [{ id: 'black', name: 'Black', colors: { metal: '#27272a' } }, { id: 'brass', name: 'Brass', colors: { metal: '#d4af37' } }], model: { type: 'procedural', builder: 'lamp', params: { sconce: true } } },
  { id: 'wall-art', name: 'Framed Wall Canvas', category: 'decor', tags: ['art', 'painting', 'frame', 'picture', 'wall'], size: [1.2, 0.05, 0.8], placement: 'wall', variants: [{ id: 'abstract', name: 'Abstract Blue', colors: { frame: '#27272a', art: '#4f6d8f' } }, { id: 'warm', name: 'Warm Ochre', colors: { frame: '#6e4b32', art: '#c2703d' } }], model: { type: 'procedural', builder: 'wallArt' } },
  { id: 'console-table', name: 'Console Table', category: 'decor', tags: ['table', 'entry', 'hallway', 'foyer', 'console'], size: [1.2, 0.38, 0.8], placement: 'wall', variants: wood, model: { type: 'procedural', builder: 'table', params: { console: true } } },
  { id: 'planter', name: 'Planter (GLB sample)', category: 'decor', tags: ['pot', 'glb'], size: [0.6, 0.6, 0.5], placement: 'floor', model: { type: 'glb', url: './models/planter.glb' } },

  // ===================== OUTDOOR =====================
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
  { id: 'parasol', name: 'Parasol', category: 'outdoor', tags: ['umbrella', 'shade'], size: [2.5, 2.5, 2.4], placement: 'floor', variants: parasolColors, model: { type: 'procedural', builder: 'parasol' } },
  { id: 'garden-lamp', name: 'Garden lamp', category: 'outdoor', tags: ['light', 'path', 'bollard'], size: [0.25, 0.25, 0.9], placement: 'floor', variants: [{ id: 'black', name: 'Black', colors: { shade: '#fef3c7', metal: '#27272a' } }], model: { type: 'procedural', builder: 'lamp', params: { bollard: true } } },
  { id: 'sun-lounger', name: 'Sun Lounger', category: 'outdoor', tags: ['pool', 'deck', 'chair', 'lounger', 'sun', 'patio'], size: [0.7, 2.0, 0.45], placement: 'floor', variants: outdoorCanvas, model: { type: 'procedural', builder: 'sunLounger' } },
  { id: 'bbq-grill', name: 'Barbecue Grill Station', category: 'outdoor', tags: ['bbq', 'grill', 'cook', 'outdoor', 'patio'], size: [1.4, 0.65, 1.2], placement: 'floor', variants: steel, model: { type: 'procedural', builder: 'bbqGrill' } },
  { id: 'fire-pit', name: 'Stone Fire Pit', category: 'outdoor', tags: ['fire', 'pit', 'patio', 'stone', 'cozy', 'garden'], size: [1.4, 1.4, 0.45], placement: 'floor', variants: [{ id: 'sandstone', name: 'Sandstone', colors: { stone: '#8b6b4a' } }, { id: 'slate', name: 'Charcoal Slate', colors: { stone: '#3f3f46' } }], model: { type: 'procedural', builder: 'firePit' } },
  { id: 'pergola', name: 'Garden Timber Pergola', category: 'outdoor', tags: ['pergola', 'arbor', 'patio', 'wood', 'shade', 'garden'], size: [3.0, 3.0, 2.6], placement: 'floor', variants: outdoorWood, model: { type: 'procedural', builder: 'pergola' } },
  { id: 'patio-set', name: 'Patio Dining Set (4)', category: 'outdoor', tags: ['patio', 'dining', 'table', 'outdoor', 'wicker'], size: [1.5, 1.0, 0.75], placement: 'floor', variants: outdoorWood, model: { type: 'procedural', builder: 'patioSet' } }
]
