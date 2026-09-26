// Typed length while drawing: "3.5", "350cm", "11'6\"", "4x3" (rectangles). Enter applies it.
import { parse, type Units } from '../units'

export function createEntry() {
  let buf = ''
  return {
    get text() {
      return buf
    },
    clear() {
      buf = ''
    },
    /** Consume a key if it belongs to a length being typed. */
    key(e: KeyboardEvent): boolean {
      if (e.ctrlKey || e.metaKey || e.altKey) return false
      if (e.key === 'Backspace' && buf) return (buf = buf.slice(0, -1)), true
      if (/^[0-9.]$/.test(e.key) || (buf && /^[mcftin'" x×,]$/i.test(e.key))) return (buf += e.key), true
      return false
    },
    /** All numbers typed, parsed as lengths ("4x3" → [4, 3]); null if any part is invalid. */
    values(units: Units): number[] | null {
      const parts = buf.split(/[x×,]/i).map(s => s.trim()).filter(Boolean)
      const vals = parts.map(p => parse(p, units))
      return vals.length && vals.every(v => v !== null && v > 0) ? (vals as number[]) : null
    }
  }
}
