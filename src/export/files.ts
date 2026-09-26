// Save / open for exports: native dialogs in Neutralino, download / file picker in a plain browser.
import { isNeutralino, saveDialog, openDialog, writeBin, readBin } from '@/neu'

export interface Filter {
  name: string
  ext: string // without dot
}

/** Ask where to save and write the bytes. Resolves to the path (or the download name), or null if cancelled. */
export async function saveFile(suggested: string, bytes: Uint8Array, filter: Filter): Promise<string | null> {
  if (!isNeutralino) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart]))
    const a = Object.assign(document.createElement('a'), { href: url, download: suggested })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return suggested
  }
  let path = await saveDialog(`Save ${filter.name}`, [{ name: filter.name, extensions: [filter.ext] }])
  if (!path) return null
  if (!path.toLowerCase().endsWith(`.${filter.ext}`)) path += `.${filter.ext}`
  await writeBin(path, bytes)
  return path
}

export async function openFile(filter: Filter): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (!isNeutralino) {
    return new Promise(resolve => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: `.${filter.ext}` })
      input.onchange = async () => {
        const f = input.files?.[0]
        resolve(f ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null)
      }
      input.click()
    })
  }
  const [path] = (await openDialog(`Open ${filter.name}`, [{ name: filter.name, extensions: [filter.ext] }])) ?? []
  if (!path) return null
  return { name: path.split(/[\\/]/).pop() ?? path, bytes: new Uint8Array(await readBin(path)) }
}

/** "My House" → "my-house" for default file names. */
export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
