/**
 * Colour maths shared by the palette generator and the contrast test (no dependency).
 * sRGB hex ⇄ OKLCH, gamut mapping, WCAG 2.x relative luminance and contrast ratio.
 */

export interface Oklch { l: number, c: number, h: number }

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = Number.parseInt(h.length === 3 ? h.replace(/./g, ch => ch + ch) : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function rgbToOklch([r, g, b]: [number, number, number]): Oklch {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.hypot(a, bb)
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

/** Unclamped linear-light result: values outside [0, 1] mean "out of the sRGB gamut". */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function inGamut(color: Oklch): boolean {
  return oklchToLinear(color).every(v => v >= -1e-4 && v <= 1 + 1e-4)
}

/** Reduces chroma (keeping lightness and hue) until the colour fits in sRGB. */
export function toGamut(color: Oklch): Oklch {
  if (inGamut(color)) return color
  let [lo, hi] = [0, color.c]
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (inGamut({ ...color, c: mid })) lo = mid
    else hi = mid
  }
  return { ...color, c: lo }
}

export function oklchToRgb(color: Oklch): [number, number, number] {
  return oklchToLinear(toGamut(color)).map(v => linearToSrgb(Math.min(1, Math.max(0, v)))) as [number, number, number]
}

/** Parses `oklch(62.1% 0.141 41.5)` or a hex colour. */
export function parseColor(value: string): [number, number, number] {
  const v = value.trim()
  if (v.startsWith('#')) return hexToRgb(v)
  const m = v.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/)
  if (!m) throw new Error(`unsupported colour: ${value}`)
  return oklchToRgb({ l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) })
}

export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map(v => srgbToLinear(Math.round(v * 255) / 255))
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(parseColor(a)), relativeLuminance(parseColor(b))]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
