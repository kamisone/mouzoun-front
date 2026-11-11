import type { BrandColorName } from './palette'

/** Nuxt UI colour aliases → brand palettes (used by app.config.ts and the contrast test). */
export const UI_COLORS = {
  primary: 'terracotta',
  secondary: 'olive',
  success: 'sage',
  info: 'dusk',
  warning: 'ochre',
  error: 'clay',
  neutral: 'stone',
} as const satisfies Record<string, BrandColorName>
