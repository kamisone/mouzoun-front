import type { BrandColorName } from './palette'

/** Nuxt UI colour aliases → brand palettes (used by app.config.ts and the contrast test). */
export const UI_COLORS = {
  primary: 'terracotta',
  secondary: 'palm',
  success: 'palm',
  info: 'indigo',
  warning: 'saffron',
  error: 'clay',
  neutral: 'dune',
} as const satisfies Record<string, BrandColorName>
