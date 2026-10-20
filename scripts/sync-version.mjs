// `npm version` hook: keep neutralino.config.json on the same version as package.json.
import { readFileSync, writeFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const f = 'neutralino.config.json'
writeFileSync(f, readFileSync(f, 'utf8').replace(/"version": "[^"]*"/, `"version": "${version}"`))
