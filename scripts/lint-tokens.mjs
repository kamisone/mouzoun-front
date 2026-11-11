// Design-system guard (run by `npm run lint`): in .vue/.ts files under app/,
//  - no colour literals (#hex, rgb(), hsl(), oklch()) — use semantic tokens (bg-default, text-muted...)
//  - no raw palette classes (bg-terracotta-500, text-orange-600...) — use bg-primary, text-error...
//  - no physical direction utilities (ml-, pr-, left-, text-right...) — use ms-, pe-, start-, text-end
//  - no @nuxt/image `sizes` without breakpoint prefix
// app/assets/css/main.css and app/theme/ are the only places allowed to hold raw colours.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const ALLOWED = [/^app\/assets\/css\//, /^app\/theme\//]
const PALETTES = 'terracotta|palm|dune|saffron|indigo|clay|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white'
const RULES = [
  // @nuxt/image: an unprefixed size ("100vw") becomes a 1 px srcset candidate. Use "xs:100vw ...".
  { name: 'image sizes without breakpoint (use xs:100vw ...)', re: /\bsizes(?:="|:\s*')\s*\d+(?:vw|px)/g },
  { name: 'colour literal', re: /(?<![\w&/-])#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(/g },
  { name: 'raw palette class', re: new RegExp(String.raw`(?<![\w-])(?:[a-z]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|shadow|accent|caret)-(?:${PALETTES})(?:-\d{2,3})?(?:\/\d+)?(?![\w-])`, 'g') },
  {
    name: 'physical direction utility (use ms/me/ps/pe/start/end)',
    re: /(?<![\w-])(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|scroll-m[lr]|scroll-p[lr])-(?:\d[\w./]*|\[[^\]]*\]|px|auto|full)(?![\w-])|(?<![\w-])(?:[a-z-]+:)*(?:rounded-[lr]|rounded-[tb][lr]|border-[lr])(?:-[\w./[\]-]+)?(?![\w-])|(?<![\w-])(?:[a-z-]+:)*(?:text-left|text-right|float-left|float-right|clear-left|clear-right)(?![\w-])/g,
  },
]

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.(vue|ts)$/.test(name) ? [path] : []
  })
}

let problems = 0
for (const file of files(join(root, 'app'))) {
  const rel = relative(root, file)
  if (ALLOWED.some(re => re.test(rel))) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/lint-tokens-ignore/.test(line)) return
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.re)) {
        problems++
        console.error(`${rel}:${i + 1}  ${rule.name}: ${match[0].trim()}`)
      }
    }
  })
}
if (problems) {
  console.error(`\n✖ ${problems} design-token problem(s). See docs/DESIGN_SYSTEM.md (Do / Don't).`)
  process.exit(1)
}
console.log('✔ design tokens: no raw colours or physical direction utilities')
