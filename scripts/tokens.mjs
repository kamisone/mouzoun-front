// Regenerates the brand colour scales in app/assets/css/main.css from app/theme/palette.ts.
// Run: npm run tokens   (only the block between the BEGIN/END markers is replaced).
import { readFileSync, writeFileSync } from 'node:fs'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { cssDeclarations } = await jiti.import('../app/theme/palette.ts')
const file = new URL('../app/assets/css/main.css', import.meta.url)
const css = readFileSync(file, 'utf8')
const begin = '  /* BEGIN generated brand scales (npm run tokens) */'
const end = '  /* END generated brand scales */'
const [head, rest] = css.split(begin)
if (rest === undefined) throw new Error('markers not found in main.css')
const [, tail] = rest.split(end)
writeFileSync(file, `${head}${begin}\n${cssDeclarations()}\n${end}${tail}`)
console.log('brand scales written to app/assets/css/main.css')
