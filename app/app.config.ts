import { UI_COLORS } from './theme/colors'

/**
 * Admin and forms only: "soft"/"subtle" variants put coloured text on a 10–15 % tint of the same
 * colour; in light mode the text uses shade 700 so it keeps 4.5:1 (tests/unit/contrast.spec.ts).
 */
const TINTED_COLORS = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const
const tintedText = (color: string) => `text-${color}-700 dark:text-${color}`
const tinted = <V extends string>(variants: V[], cls: (color: string) => string | Record<string, string>) =>
  TINTED_COLORS.flatMap(color => variants.map(variant => ({ color, variant, class: cls(color) })))

/**
 * Global look of Nuxt UI components, configured ONCE here (never re-styled per usage).
 * Quiet and precise: small radii (2 px inputs, 4 px surfaces), hairlines instead of shadows,
 * one accent. Only semantic classes and the 4/8 spacing scale.
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
      arrowLeft: 'i-lucide-arrow-left',
      arrowRight: 'i-lucide-arrow-right',
    },
    button: {
      slots: {
        base: 'rounded-xs font-medium tracking-button justify-center transition-colors duration-300',
        leadingIcon: 'size-4',
        trailingIcon: 'size-4',
      },
      variants: {
        size: {
          sm: { base: 'min-h-9 px-4 py-2 text-small gap-2' },
          md: { base: 'min-h-12 px-6 py-3 text-small gap-2' },
          lg: { base: 'min-h-12 px-8 py-3 text-body gap-3' },
          xl: { base: 'min-h-12 px-8 py-4 text-body gap-3' },
        },
      },
      compoundVariants: [
        // Primary: solid accent, darker on hover (terracotta 600, the specified hover colour).
        { color: 'primary', variant: 'solid', class: 'text-inverted bg-primary hover:bg-primary-600 active:bg-primary-600 dark:hover:bg-primary-200 dark:active:bg-primary-200' },
        // Secondary: 1 px ink outline.
        { color: 'neutral', variant: 'outline', class: 'ring ring-inset ring-inverted text-highlighted bg-transparent hover:bg-inverted/5 active:bg-inverted/10' },
        // Quiet icon / ghost buttons.
        { color: 'neutral', variant: 'ghost', class: 'text-highlighted hover:bg-inverted/5' },
        ...tinted(['soft', 'subtle'], tintedText),
      ],
      defaultVariants: { size: 'md' },
    },
    input: {
      slots: { base: 'rounded-xs bg-elevated' },
      variants: {
        size: {
          md: { base: 'min-h-12 px-4 py-3 text-body' },
          sm: { base: 'min-h-9 px-3 py-2 text-small' },
        },
        variant: { outline: { base: 'ring ring-inset ring-accented' } },
      },
      defaultVariants: { size: 'md' },
    },
    textarea: {
      slots: { base: 'rounded-xs bg-elevated' },
      variants: { variant: { outline: { base: 'ring ring-inset ring-accented' } } },
    },
    select: { slots: { base: 'rounded-xs' }, defaultVariants: { size: 'md' } },
    card: {
      slots: {
        root: 'rounded-sm',
        header: 'p-6',
        body: 'p-6',
        footer: 'p-6',
      },
      variants: { variant: { outline: { root: 'bg-elevated ring ring-default divide-y divide-default' } } },
    },
    badge: {
      slots: { base: 'rounded-full font-medium tracking-button' },
      compoundVariants: tinted(['soft', 'subtle', 'outline'], tintedText),
    },
    alert: {
      slots: { root: 'rounded-xs' },
      compoundVariants: tinted(['soft', 'subtle', 'outline'], color => ({ root: tintedText(color) })),
    },
    formField: {
      slots: {
        label: 'text-small font-medium text-highlighted',
        description: 'text-small text-muted',
        help: 'mt-2 text-small text-muted',
        error: 'mt-2 text-small text-error',
        hint: 'text-small text-muted',
      },
    },
    modal: { slots: { content: 'rounded-sm shadow-overlay ring ring-default' } },
    slideover: { slots: { content: 'shadow-overlay ring ring-default' } },
    popover: { slots: { content: 'rounded-sm shadow-overlay ring ring-default' } },
    dropdownMenu: { slots: { content: 'rounded-sm shadow-overlay ring ring-default', item: 'rounded-xs' } },
    tooltip: { slots: { content: 'rounded-xs' } },
    navigationMenu: {
      slots: { link: 'font-medium' },
    },
    table: {
      slots: {
        th: 'text-caption font-medium uppercase tracking-label text-muted',
        td: 'text-small',
      },
    },
  },
})
