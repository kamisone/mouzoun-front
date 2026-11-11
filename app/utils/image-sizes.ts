/** Breakpoints of @nuxt/image / Tailwind, in px. */
const SCREENS: Record<string, number> = { xs: 320, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }

/**
 * "xs:100vw sm:50vw lg:33vw" (the @nuxt/image notation used across the app) → a standard
 * `sizes` attribute: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw".
 */
export function toCssSizes(sizes: string): string {
  const entries = sizes
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const [bp, size] = entry.includes(':') ? entry.split(':') as [string, string] : ['xs', entry]
      return { min: SCREENS[bp] ?? Number.parseInt(bp), size: size! }
    })
    .sort((a, b) => b.min - a.min)
  return entries.map(e => (e.min <= SCREENS.xs! ? e.size : `(min-width: ${e.min}px) ${e.size}`)).join(', ')
}
