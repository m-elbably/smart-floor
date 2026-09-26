// Runs every src/**/*.check.ts self-check with tsx; exits non-zero on the first failure.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const files = readdirSync('src', { recursive: true })
  .filter(f => f.endsWith('.check.ts'))
  .map(f => join('src', f))

for (const f of files) {
  execFileSync('npx', ['tsx', f], { stdio: 'inherit' })
  console.log(`✓ ${f}`)
}
console.log(`${files.length} check file(s) passed`)
