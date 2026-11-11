/**
 * Light / dark / system theme. One explicit choice (made with MzThemeToggle) applies everywhere
 * and is remembered; without one, the public site is light and the admin follows the system.
 * The colour-mode module's inline script applies the stored mode before the first paint (no
 * flash on SSR).
 */
export type ThemeChoice = 'light' | 'dark' | 'system'

const EXPLICIT_KEY = 'mz-color-mode-explicit'

export function useThemePreference() {
  const colorMode = useColorMode()

  const preference = computed<ThemeChoice>({
    get: () => (['light', 'dark', 'system'].includes(colorMode.preference) ? colorMode.preference as ThemeChoice : 'light'),
    set: (value) => {
      colorMode.preference = value
      try {
        localStorage.setItem(EXPLICIT_KEY, '1')
      }
      catch {
        // Private mode: the choice still applies for this visit.
      }
    },
  })

  /** Applies an area's default unless the person chose explicitly. Client only. */
  function applyDefault(fallback: ThemeChoice) {
    if (import.meta.server) return
    let explicit = false
    try {
      explicit = localStorage.getItem(EXPLICIT_KEY) === '1'
    }
    catch {
      explicit = false
    }
    if (!explicit && colorMode.preference !== fallback) colorMode.preference = fallback
  }

  return { preference, applyDefault, isDark: computed(() => colorMode.value === 'dark') }
}
