import { UI_COLORS } from './theme/colors'

/**
 * Global look of Nuxt UI components, configured ONCE here (never re-styled per usage).
 * Only semantic classes (bg-default, text-muted, ring-default...) are allowed.
 */
export default defineAppConfig({
  ui: {
    colors: UI_COLORS,
    icons: {
      // Lucide everywhere (Nuxt UI default set), listed here for discoverability.
      arrowLeft: 'i-lucide-arrow-left',
      arrowRight: 'i-lucide-arrow-right',
    },
    button: {
      slots: {
        base: 'rounded-md font-semibold justify-center',
      },
      variants: {
        // ≥ 44 px touch targets from size md up (WCAG 2.5.8 recommends 24, we aim for 44 on public pages).
        size: {
          md: { base: 'min-h-11 px-4 py-2.5 text-sm' },
          lg: { base: 'min-h-12 px-5 py-3 text-base' },
          xl: { base: 'min-h-14 px-6 py-3.5 text-base' },
        },
      },
      defaultVariants: { size: 'md' },
    },
    input: {
      slots: { base: 'rounded-md' },
      variants: { size: { md: { base: 'min-h-11' }, lg: { base: 'min-h-12' } } },
      defaultVariants: { size: 'md' },
    },
    select: { defaultVariants: { size: 'md' } },
    textarea: { slots: { base: 'rounded-md' } },
    card: {
      slots: {
        root: 'rounded-lg shadow-soft',
        header: 'p-5 sm:px-6',
        body: 'p-5 sm:p-6',
        footer: 'p-5 sm:px-6',
      },
    },
    badge: {
      slots: { base: 'rounded-full font-semibold' },
    },
    formField: {
      slots: { label: 'font-semibold text-highlighted', error: 'mt-1.5 text-error' },
    },
    modal: { slots: { content: 'rounded-xl shadow-lifted' } },
    slideover: { slots: { content: 'shadow-lifted' } },
    navigationMenu: { slots: { link: 'font-medium' } },
  },
})
