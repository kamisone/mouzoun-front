import type { InjectionKey, Ref } from 'vue'

/**
 * Comfortable (public site) or compact (admin) density. The admin layout provides `compact`;
 * Mz components read it, and admin pages pass `:size="size"` to raw Nuxt UI components.
 */
export type Density = 'comfortable' | 'compact'
export const DENSITY_KEY: InjectionKey<Ref<Density>> = Symbol('mz-density')

export function provideDensity(density: Density) {
  provide(DENSITY_KEY, ref(density))
}

export function useDensity() {
  const density = inject(DENSITY_KEY, ref<Density>('comfortable'))
  return {
    density,
    /** Default Nuxt UI size for the current density. */
    size: computed(() => (density.value === 'compact' ? 'sm' : 'md') as 'sm' | 'md'),
    compact: computed(() => density.value === 'compact'),
  }
}
