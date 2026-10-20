// Thin typed wrappers over the Neutralino APIs the app uses.
import { init, app, os, filesystem, events } from '@neutralinojs/lib'

function getToken(): string {
  try {
    return (
      (typeof window !== 'undefined' ? (window as any).NL_TOKEN : '') ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('NL_TOKEN') : '') ||
      ''
    )
  } catch {
    return ''
  }
}

function hasValidToken(): boolean {
  const token = getToken()
  return typeof token === 'string' && token.includes('.')
}

// In development with Vite, if NL_TOKEN was consumed or cleared (e.g. after reload),
// recover it synchronously from Vite's served .tmp/auth_info.json so init() can connect.
function ensureDevAuth(): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return
  if (hasValidToken()) return
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', '/.tmp/auth_info.json', false)
    xhr.send(null)
    if (xhr.status === 200) {
      const auth = JSON.parse(xhr.responseText)
      if (auth.nlToken) {
        ;(window as any).NL_TOKEN = auth.nlToken
        if (typeof (window as any).NL_PORT === 'undefined' && auth.nlPort) {
          ;(window as any).NL_PORT = auth.nlPort
        }
        try {
          sessionStorage.setItem('NL_TOKEN', auth.nlToken)
        } catch {}
      }
    }
  } catch {
    // Plain browser or non-dev environment without auth file
  }
}

ensureDevAuth()

/** True when running inside the Neutralino shell with a valid auth token (false in a plain browser tab). */
export const isNeutralino =
  typeof window !== 'undefined' &&
  typeof (window as any).NL_PORT !== 'undefined' &&
  (Boolean((window as any).NL_GINJECTED) || hasValidToken())

export function initNeutralino() {
  ensureDevAuth()
  if (isNeutralino) {
    try {
      init()
    } catch (err) {
      console.warn('Failed to initialize Neutralino:', err)
    }
  }
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
  if (typeof window === 'undefined') return
  events.on('windowClose', async () => {
    try {
      await Promise.race([
        Promise.resolve().then(() => handler()),
        new Promise(resolve => setTimeout(resolve, 2500)),
      ])
    } catch (err) {
      console.error('Error in windowClose handler:', err)
    } finally {
      try {
        await Promise.race([
          app.exit(),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ])
      } catch (err) {
        console.error('Failed to exit application via app.exit():', err)
      }
    }
  })
}
