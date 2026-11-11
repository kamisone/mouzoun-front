import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio, parseColor, rgbToHex } from '../../app/theme/color-math'
import { UI_COLORS } from '../../app/theme/colors'

/**
 * WCAG AA for the semantic token pairs, in both themes, computed from the real values in
 * main.css (palette scales + :root / .dark mappings). Body text 4.5:1, large text and UI 3:1.
 */
const css = readFileSync(new URL('../../app/assets/css/main.css', import.meta.url), 'utf8')

const scales = new Map<string, string>()
for (const m of css.matchAll(/--color-([a-z]+-\d+):\s*([^;]+);/g)) scales.set(m[1]!, m[2]!.trim())

function block(selector: RegExp): Map<string, string> {
  const body = css.match(selector)?.[1]
  if (!body) throw new Error(`block ${selector} not found`)
  return new Map([...body.matchAll(/--(ui-[\w-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]))
}
const light = block(/:root,\s*\.light\s*\{([\s\S]*?)\n\}/)
const dark = block(/\n\.dark\s*\{([\s\S]*?)\n\}/)

/** Resolves `var(--ui-color-primary-600)` → the brand scale value, or a literal colour. */
function resolve(theme: Map<string, string>, token: string): string {
  const value = theme.get(token)
  if (!value) throw new Error(`token --${token} missing`)
  const ref = value.match(/^var\(--ui-color-(\w+)-(\d+)\)$/)
  if (!ref) return value
  const palette = UI_COLORS[ref[1] as keyof typeof UI_COLORS]
  const color = scales.get(`${palette}-${ref[2]}`)
  if (!color) throw new Error(`scale ${palette}-${ref[2]} missing`)
  return color
}

type Pair = [fg: string, bg: string, min: number]
const BODY = 4.5
const LARGE = 3
const pairs: Pair[] = [
  ['ui-text', 'ui-bg', BODY],
  ['ui-text', 'ui-bg-elevated', BODY],
  ['ui-text', 'ui-bg-muted', BODY],
  ['ui-text-highlighted', 'ui-bg', BODY],
  ['ui-text-toned', 'ui-bg', BODY],
  ['ui-text-muted', 'ui-bg', BODY],
  ['ui-text-muted', 'ui-bg-elevated', BODY],
  ['ui-text-muted', 'ui-bg-muted', BODY],
  ['ui-text-dimmed', 'ui-bg', BODY], // placeholders are text too (WCAG 1.4.3)
  ['ui-text-dimmed', 'ui-bg-elevated', BODY],
  ['ui-primary', 'ui-bg', BODY], // links, text-primary
  ['ui-primary', 'ui-bg-elevated', BODY],
  ['ui-secondary', 'ui-bg', BODY],
  ['ui-success', 'ui-bg', BODY],
  ['ui-info', 'ui-bg', BODY],
  ['ui-warning', 'ui-bg', BODY],
  ['ui-error', 'ui-bg', BODY],
  ['ui-text-inverted', 'ui-primary', BODY], // solid buttons, CTA banner
  ['ui-text-inverted', 'ui-secondary', BODY],
  ['ui-text-inverted', 'ui-error', BODY],
  ['ui-text-inverted', 'ui-bg-inverted', BODY],
  ['ui-primary', 'ui-bg', LARGE], // focus ring against the page (non-text, 3:1)
  ['ui-border-accented', 'ui-bg', 1.3], // decorative separators (not a WCAG requirement)
]

describe.each([['light', light], ['dark', dark]] as const)('%s theme', (_, theme) => {
  it.each(pairs)('%s on %s ≥ %d:1', (fg, bg, min) => {
    const ratio = contrastRatio(resolve(theme, fg), resolve(theme, bg))
    expect(ratio, `${fg} on ${bg}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min)
  })
})

/** `color` at `alpha` over `bg` (sRGB blend, what the browser paints for bg-primary/15). */
function over(color: string, alpha: number, bg: string): string {
  const [a, b] = [parseColor(color), parseColor(bg)]
  return rgbToHex(a.map((v, i) => v * alpha + b[i]! * (1 - alpha)) as [number, number, number])
}

// Soft / subtle buttons, badges and alerts: tinted text on a tint of the same colour
// (app.config.ts: shade 700 in light mode, the semantic colour in dark mode).
describe.each(['primary', 'secondary', 'success', 'info', 'warning', 'error'])('tinted %s', (alias) => {
  const palette = UI_COLORS[alias as keyof typeof UI_COLORS]
  it.each([0.1, 0.15])('light: %s tint', (alpha) => {
    const text = scales.get(`${palette}-${alias === 'warning' ? 800 : 700}`)!
    const bg = over(resolve(light, `ui-${alias}`), alpha, resolve(light, 'ui-bg'))
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(BODY)
  })
  it.each([0.1, 0.15])('dark: %s tint', (alpha) => {
    const text = resolve(dark, `ui-${alias}`)
    const bg = over(text, alpha, resolve(dark, 'ui-bg'))
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(BODY)
  })
})

describe('palette', () => {
  it('keeps each brand colour exact at 500 and the dune ends exact', async () => {
    const { BRAND_COLORS, scale } = await import('../../app/theme/palette')
    const { oklchToRgb, rgbToHex } = await import('../../app/theme/color-math')
    for (const [name, color] of Object.entries(BRAND_COLORS)) {
      expect(rgbToHex(oklchToRgb(scale(color)[500])).toLowerCase(), name).toBe(color.base.toLowerCase())
    }
    const dune = scale(BRAND_COLORS.dune)
    expect(rgbToHex(oklchToRgb(dune[50]))).toBe('#fbf7f0')
    expect(rgbToHex(oklchToRgb(dune[950]))).toBe('#1e1812')
  })

  it('is in sync with main.css (run `npm run tokens` after editing palette.ts)', async () => {
    const { cssDeclarations } = await import('../../app/theme/palette')
    expect(css).toContain(cssDeclarations())
  })
})
