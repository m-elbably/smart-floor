// Entity shapes shared by db, editor and scene. All lengths in metres, angles in degrees.
export type Vec2 = [number, number]

export interface Project {
  id: string
  name: string
  description: string
  thumbnail: Uint8Array | null
  site: Vec2[] | null
  createdAt: number
  updatedAt: number
}

export interface Floor {
  id: string
  projectId: string
  name: string
  level: number
  elevation: number
  height: number
  slab: number
}

export interface Room {
  id: string
  floorId: string
  name: string
  kind: string
  polygon: Vec2[]
  floorMaterial: string
  wallColor: string
  ceiling: boolean
}

export interface Wall {
  id: string
  floorId: string
  a: Vec2
  b: Vec2
  thickness: number
  height: number
  kind: 'wall' | 'fence'
}

export type OpeningHost = { roomId: string; edge: number } | { wallId: string }

export interface Opening {
  id: string
  floorId: string
  host: OpeningHost
  along: number // centre distance from the host edge start
  kind: 'door' | 'window'
  preset: string
  width: number
  height: number
  sill: number
  props: Record<string, unknown>
}

export interface Stair {
  id: string
  floorId: string
  kind: 'straight' | 'L' | 'U' | 'spiral'
  x: number
  y: number
  rotation: number
  params: Record<string, unknown>
}

export interface Zone {
  id: string
  floorId: string
  kind: 'grass' | 'patio' | 'path' | 'pool' | 'driveway'
  polygon: Vec2[]
  props: Record<string, unknown>
}

export interface Item {
  id: string
  floorId: string
  catalogId: string
  x: number
  y: number
  z: number
  rotation: number
  scale: [number, number, number]
  variant: string | null
  name: string | null
}

export interface Tables {
  projects: Project
  floors: Floor
  rooms: Room
  walls: Wall
  openings: Opening
  stairs: Stair
  zones: Zone
  items: Item
}
export type TableName = keyof Tables
