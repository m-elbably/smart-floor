// Length formatting/parsing. Storage is always metres; imperial is display-only [FR-100].
export type Units = 'metric' | 'imperial'

const M_PER_IN = 0.0254
const FRACTIONS = ['', '¼', '½', '¾']

export function format(m: number, units: Units, decimals = 2): string {
  if (units === 'metric') {
    const abs = Math.abs(m)
    if (abs > 0 && abs < 1) return `${round(m * 100, 1)} cm`
    return `${round(m, decimals).toFixed(decimals)} m`
  }
  const sign = m < 0 ? '-' : ''
  const quarters = Math.round((Math.abs(m) / M_PER_IN) * 4)
  const ft = Math.floor(quarters / 48)
  const inches = Math.floor((quarters % 48) / 4)
  const inchPart = `${inches}${FRACTIONS[quarters % 4]}"`
  return ft ? `${sign}${ft}' ${inchPart}` : `${sign}${inchPart}`
}

export function formatArea(m2: number, units: Units): string {
  return units === 'metric' ? `${m2.toFixed(2)} m²` : `${(m2 / (M_PER_IN * 12) ** 2).toFixed(1)} ft²`
}

const UNIT_FACTORS: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, in: M_PER_IN, '"': M_PER_IN, ft: 0.3048, "'": 0.3048 }

/**
 * Parse a user-typed length into metres, or null if invalid.
 * Accepts: 3.5 · 3,5 · 3.5m · 350cm · 3500 mm · 11' · 11'3" · 11ft 3in · 5.5in.
 * A bare number means metres in metric and feet in imperial.
 */
export function parse(input: string, units: Units = 'metric'): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ')
  if (!s) return null
  const bare = s.match(/^-?\d*\.?\d+$/)
  if (bare) return Number(s) * (units === 'metric' ? 1 : 0.3048)
  const re = /(-?\d*\.?\d+) ?(mm|cm|m|in|ft|'|")/g
  const parts = [...s.matchAll(re)]
  // Only feet+inches may be combined (11'3"); "2.80 m300cm" is a typo, not a sum.
  if (parts.length > 2 || (parts.length === 2 && !(isFeet(parts[0][2]) && isInches(parts[1][2])))) return null
  if (parts.map(m => m[0]).join('').replace(/ /g, '') !== s.replace(/ /g, '')) return null
  return parts.reduce((t, m) => t + Number(m[1]) * UNIT_FACTORS[m[2]], 0)
}

const isFeet = (u: string) => u === 'ft' || u === "'"
const isInches = (u: string) => u === 'in' || u === '"'

function round(n: number, d: number) {
  const f = 10 ** d
  return Math.round(n * f) / f
}
