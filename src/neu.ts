// Thin typed wrappers over the Neutralino APIs the app uses.
import { init, app, os, filesystem, events } from '@neutralinojs/lib'

/** True when running inside the Neutralino shell (false in a plain browser tab). */
export const isNeutralino = typeof (window as any).NL_PORT !== 'undefined'

export function initNeutralino() {
  if (isNeutralino) init()
}

export async function dataDir(): Promise<string> {
  const dir = (await os.getPath('data')) + '/smart-floor'
  if (!(await exists(dir))) await filesystem.createDirectory(dir)
  return dir
}

export async function exists(path: string): Promise<boolean> {
  try {
    await filesystem.getStats(path)
    return true
  } catch {
    return false
  }
}

export const readBin = (path: string) => filesystem.readBinaryFile(path)
export const writeBin = (path: string, data: Uint8Array) =>
  filesystem.writeBinaryFile(path, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
export const move = (from: string, to: string) => filesystem.move(from, to)
export const copy = (from: string, to: string) => filesystem.copy(from, to, { recursive: false, overwrite: true, skip: false })
export const stats = (path: string) => filesystem.getStats(path)
export const remove = (path: string) => filesystem.remove(path)

export const saveDialog = (title: string, filters: { name: string; extensions: string[] }[]) =>
  os.showSaveDialog(title, { filters })
export const openDialog = (title: string, filters: { name: string; extensions: string[] }[]) =>
  os.showOpenDialog(title, { filters })

/** Run `handler` before the window closes, then exit. */
export function onWindowClose(handler: () => Promise<void> | void) {
  if (!isNeutralino) return
  events.on('windowClose', async () => {
    try {
      await handler()
    } finally {
      app.exit()
    }
  })
}
