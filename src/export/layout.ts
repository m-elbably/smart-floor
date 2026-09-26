// Paper layout for the PDF plan: plan metres → page millimetres at 1:50, 1:100 or fit-to-page.
import type { Vec2 } from '../types'

export type Paper = 'a4' | 'a3'
export type PlanScale = 50 | 100 | 'fit'
export const PAPER: Record<Paper, [number, number]> = { a4: [210, 297], a3: [297, 420] }
export const MARGIN = 12
export const TITLE_H = 26

export interface PageTransform {
  /** millimetres of paper per metre of plan */
  k: number
  /** the scale actually used, as 1:denominator */
  denominator: number
  /** false when a fixed scale didn't fit and we fell back to fit-to-page */
  fixedFits: boolean
  map(p: Vec2): [number, number]
}

/** Centre the plan's bounding box in the drawing area (page minus margins and the title strip). y flips: north is up. */
export function pageTransform(min: Vec2, max: Vec2, pageW: number, pageH: number, scale: PlanScale): PageTransform {
  const availW = pageW - 2 * MARGIN
  const availH = pageH - 2 * MARGIN - TITLE_H
  const bw = Math.max(max[0] - min[0], 0.01)
  const bh = Math.max(max[1] - min[1], 0.01)
  const fitK = Math.min(availW / bw, availH / bh)
  const fixedK = scale === 'fit' ? fitK : 1000 / scale
  const fixedFits = scale === 'fit' || (bw * fixedK <= availW + 1e-9 && bh * fixedK <= availH + 1e-9)
  const k = fixedFits ? fixedK : fitK
  const ox = MARGIN + (availW - bw * k) / 2
  const oy = MARGIN + (availH - bh * k) / 2
  return { k, denominator: 1000 / k, fixedFits, map: ([x, y]) => [ox + (x - min[0]) * k, oy + (max[1] - y) * k] }
}
