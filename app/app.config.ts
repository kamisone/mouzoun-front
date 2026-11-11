import { UI_COLORS } from './theme/colors'

/**
 * "Soft" and "subtle" variants put coloured text on a 10–15 % tint of the same colour: in light
 * mode the text uses shade 700 so it keeps 4.5:1 (checked by tests/unit/contrast.spec.ts).
 */
const TINTED_COLORS = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const
// Saffron is light by nature: its tinted text needs one more step.
const tintedText = (color: string) => (color === 'warning' ? 'text-warning-800 dark:text-warning' : `text-${color}-700 dark:text-${color}`)
const tinted = <V extends string>(variants: V[], cls: (color: string) => string | Record<string, string>) =>
  TINTED_COLORS.flatMap(color => variants.map(variant => ({ color, variant, class: cls(color) })))

/**
 * Global look of Nuxt UI components, configured ONCE here (never re-styled per usage).
 * Only semantic classes (bg-default, text-muted, ring-default...) are allowed.
 */
export default defineAppConfig({
  /**
   * Public contact details. PLACEHOLDERS until the public settings API exists (the database
   * already stores them: contact.*, social.*, location.* settings).
   */
  site: {
    email: 'contact@mouzoun.com',
    phone: '',
    whatsapp: '',
    address: "M'ssici, Alnif — Rissani, Maroc",
    location: { lat: 31.238933, lng: -4.701349 },
    social: { instagram: '', facebook: '', tiktok: '' },
    /** Background of the sign-in page (public bucket URL). Empty: a desert gradient. */
    authBackground: '',
  },
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
      compoundVariants: tinted(['soft', 'subtle', 'ghost'], tintedText),
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
      compoundVariants: tinted(['soft', 'subtle', 'outline'], tintedText),
    },
    alert: {
      compoundVariants: tinted(['soft', 'subtle', 'outline'], color => ({ root: tintedText(color) })),
    },
    formField: {
      slots: { label: 'font-semibold text-highlighted', error: 'mt-1.5 text-error' },
    },
    modal: { slots: { content: 'rounded-xl shadow-lifted' } },
    slideover: { slots: { content: 'shadow-lifted' } },
    navigationMenu: { slots: { link: 'font-medium' } },
  },
})
