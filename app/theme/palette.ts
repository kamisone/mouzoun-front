/**
 * Brand palettes: the single source for colour scales. `npm run tokens` regenerates the
 * `--color-*` block of app/assets/css/main.css from this file (see docs/DESIGN_SYSTEM.md).
 */
import { type Oklch, formatOklch, hexToRgb, rgbToOklch, toGamut } from './color-math'

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export type Shade = (typeof SHADES)[number]

export interface BrandColor {
  /** Exact colour of shade 500. */
  base: string
  /** Optional exact ends of the scale (otherwise derived from the base). */
  lightest?: string
  darkest?: string
  /** Optional exact shades (e.g. a specified hover colour). */
  fixed?: Partial<Record<Shade, string>>
}

export const BRAND_COLORS = {
  /** Muted terracotta — the one accent: primary CTA, links, focus ring, small highlights. */
  terracotta: { base: '#A4502F', fixed: { 600: '#8C4227' } },
  /** Deep olive — secondary, used sparingly (tags, small details). */
  olive: { base: '#3E4A33' },
  /** Warm stone neutral: ivory to night, never pure white or black. */
  stone: { base: '#8C8273', lightest: '#F7F3EC', darkest: '#12100D' },
  /** Desaturated status colours (forms and admin only). */
  sage: { base: '#56704C' },
  dusk: { base: '#4A5F7E' },
  ochre: { base: '#9A6A22' },
  clay: { base: '#A13B2F' },
} satisfies Record<string, BrandColor>

export type BrandColorName = keyof typeof BRAND_COLORS

/** Lightness of each shade relative to the ends: perceptually even steps in OKLCH. */
const POSITION: Record<Shade, number> = {
  50: 0, 100: 0.09, 200: 0.2, 300: 0.33, 400: 0.47, 500: 0.6, 600: 0.7, 700: 0.78, 800: 0.86, 900: 0.93, 950: 1,
}
/** Chroma relative to the base: full in the middle of the scale, softer at the ends. */
const CHROMA: Record<Shade, number> = {
  50: 0.12, 100: 0.25, 200: 0.45, 300: 0.7, 400: 0.9, 500: 1, 600: 0.95, 700: 0.85, 800: 0.72, 900: 0.58, 950: 0.45,
}

export function scale(color: BrandColor): Record<Shade, Oklch> {
  const base = rgbToOklch(hexToRgb(color.base))
  const lightest = color.lightest ? rgbToOklch(hexToRgb(color.lightest)) : { l: 0.975, c: base.c * CHROMA[50], h: base.h }
  const darkest = color.darkest ? rgbToOklch(hexToRgb(color.darkest)) : { l: 0.22, c: base.c * CHROMA[950], h: base.h }
  const out = {} as Record<Shade, Oklch>
  for (const shade of SHADES) {
    const fixed = color.fixed?.[shade]
    if (fixed) { out[shade] = rgbToOklch(hexToRgb(fixed)); continue }
    if (shade === 500) { out[shade] = base; continue }
    if (shade === 50 && color.lightest) { out[shade] = lightest; continue }
    if (shade === 950 && color.darkest) { out[shade] = darkest; continue }
    const p = POSITION[shade]
    // Piecewise-linear lightness through the base at 500.
    const l = p < POSITION[500]
      ? lightest.l + (base.l - lightest.l) * (p / POSITION[500])
      : base.l + (darkest.l - base.l) * ((p - POSITION[500]) / (1 - POSITION[500]))
    out[shade] = toGamut({ l, c: base.c * CHROMA[shade], h: base.h })
  }
  return out
}

/** `--color-<name>-<shade>: oklch(...)` declarations for every brand colour. */
export function cssDeclarations(): string {
  return Object.entries(BRAND_COLORS)
    .map(([name, color]) => {
      const s = scale(color)
      return SHADES.map(shade => `  --color-${name}-${shade}: ${formatOklch(s[shade])};`).join('\n')
    })
    .join('\n\n')
}
