// Build guard: `neu run` temporarily points index.html at its dev server; never ship that.
import { readFileSync } from 'node:fs'
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
if (!html.includes('src="/__neutralino_globals.js"')) {
  console.error('index.html still has the neu dev patch (a localhost globals URL). Stop `npm run dev` (close the app window) and build again.')
  process.exit(1)
}
