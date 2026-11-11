# Mouzoun design system

Nuxt UI v4 (Tailwind CSS v4, Reka UI) themed with Mouzoun tokens, plus a thin layer of `Mz`
components that add domain meaning. Live reference: **`/_styleguide`** (dev, or staff in
production) — colour scales, semantic tokens in light/dark, Latin and Arabic type, every
component, with an LTR/RTL switch.

```
app/assets/css/main.css   tokens: brand scales, semantic colours, type, radius, shadows, rhythm, layers, motion
app/theme/palette.ts      brand colours (source of the scales)  →  npm run tokens
app/theme/colors.ts       Nuxt UI aliases → palettes (primary = terracotta, ...)
app/app.config.ts         global look of Nuxt UI components (once, never per usage)
app/components/{base,layout,marketing,forms,admin}/Mz*.vue
app/composables/          useMoney, useDate, useNumber, useLocalized, useSeo, useValidation,
                          useThemePreference, useDensity, useTableQuery
```

## Tokens

### Colours

| Alias | Palette | Meaning |
|---|---|---|
| `primary` | terracotta (#C65D35) | earth, kasbah walls — actions, links |
| `secondary`, `success` | palm (#5B7A3A) | oasis, olive and date trees |
| `warning` | saffron (#D9A13B) | dates, sunset |
| `info` | indigo (#2F4A8A) | Tuareg blue, night sky |
| `error` | clay (#B3362B) | |
| `neutral` | dune (#FBF7F0 → #A88B68 → #1E1812) | warm sand, never grey or black |

Scales 50–950 are generated in OKLCH (perceptually even steps, the brand colour exact at 500).

**Components use semantic classes only**:

| Purpose | Classes |
|---|---|
| backgrounds | `bg-default` `bg-muted` `bg-elevated` `bg-accented` `bg-inverted` |
| text | `text-highlighted` (headings) `text-default` `text-toned` `text-muted` `text-dimmed` (placeholders) `text-inverted` |
| borders | `border-default` `border-muted` `border-accented`, `ring-default`, `divide-default` |
| brand | `text-primary` `bg-primary` `bg-primary/10` … same for secondary, success, info, warning, error |

Light theme = warm sand, dark theme = "desert night" (warm brown-black). Brand shade 500 is too
light for text on sand, so in light mode `--ui-primary` is shade 600 (and soft/subtle variants use
700). Every pair is checked for WCAG AA by `tests/unit/contrast.spec.ts` (4.5:1 for text including
placeholders, 3:1 for large text and UI), with the real values of `main.css`, tints included;
axe checks the rendered pages in Playwright.

### Type

`font-display` (Fraunces) for headings — `h1–h3` get it automatically — and `font-sans` (Inter)
for everything else. Any Arabic content (`lang="ar"` on `<html>` or on a fragment) switches to
Noto Kufi Arabic / IBM Plex Sans Arabic through the same variables. Fonts are self-hosted by
`@nuxt/fonts`, subset by `unicode-range`, `font-display: swap`, with metric-matched fallbacks.

### Other tokens

| Token | Use |
|---|---|
| `rounded-sm/md/lg/xl/full` | radius scale (`--ui-radius` drives Nuxt UI components) |
| `shadow-soft`, `shadow-warm`, `shadow-lifted` | warm-tinted shadows: cards, hover, overlays |
| `py-(--section-y)`, `--section-gap` | fluid vertical rhythm of page sections (MzSection) |
| `max-w-page`, `max-w-narrow`, `max-w-prose-wide` | containers (MzContainer) |
| `z-(--z-sticky)` … `--z-toast` | layers: base, raised, sticky, overlay, modal, toast |
| `--duration-fast/base/slow`, `ease-out-soft` | motion; everything stops with `prefers-reduced-motion` |

## Adding a colour

1. Add it to `BRAND_COLORS` in `app/theme/palette.ts` (base at 500, optional exact ends).
2. `npm run tokens` — rewrites the generated block of `main.css` (a test fails if they drift).
3. To use it as a Nuxt UI alias, map it in `app/theme/colors.ts` and add the semantic overrides
   (`--ui-<alias>`) for light and dark in `main.css`; add its pairs to the contrast test.

## Adding a component

- Use a Nuxt UI component as is when it fits; style it **globally** in `app.config.ts` (slots,
  variants, defaultVariants), never with one-off classes.
- Create an `Mz` component only to add domain meaning (a price, an offer, a translatable field).
  Put it in `components/<base|layout|marketing|forms|admin>/MzName.vue`; it is auto-imported as
  `<MzName>`.
- Rules: `defineProps<T>()` / `defineEmits<T>()` / `defineModel`, slots for flexibility, **no
  data fetching** (the page fetches, the component displays), semantic tokens only, logical
  utilities only, keyboard and screen-reader friendly, read density with `useDensity()`.
- Show it with its variants in `pages/_styleguide.vue`; test it in `tests/components/` when it
  has logic.

## Naming

- Components `MzPascalCase`, composables `useCamelCase`, i18n keys namespaced
  `common.*`, `nav.*`, `a11y.*`, `admin.*`, `auth.*`, `validation.*`, `status.*`…
- Money is **integer cents** everywhere (`cents`, `priceFromCents`, `*_minor` from the API).
- Dates from the API: `YYYY-MM-DD` is a calendar date; anything else is an instant shown in camp
  time (Africa/Casablanca).

## RTL rules

- Logical utilities only: `ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/rounded-s`.
  `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` are rejected by `npm run lint`.
- Directional icons (arrows, chevrons) flip: `:ui="{ leadingIcon: 'rtl:rotate-180' }"` or
  `class="rtl:rotate-180"`. Non-directional icons (search, tent) never flip.
- Side panels: `side` of USlideover is physical — compute it from `useTextDirection()` (see
  MzSiteHeader, MzFormDrawer).
- Numbers, phone numbers, references and money inputs: wrap in `dir="ltr"` / `<span dir="ltr">`.
- Arabic content inside another language: give it `lang="ar" dir="rtl"` (MzTranslatableInput does).

## Do / Don't

| Do | Don't |
|---|---|
| `class="bg-elevated text-muted"` | `class="bg-white text-gray-500"`, `style="color:#666"` |
| `class="text-primary"`, `<UButton color="primary">` | `class="text-terracotta-600"`, `bg-orange-500` |
| `class="ms-2 ps-4 text-start"` | `class="ml-2 pl-4 text-left"` |
| Global look in `app.config.ts` | `<UButton class="rounded-xl font-bold px-7">` on every page |
| `<MzPrice :cents="4500" from unit="person" />` | `{{ (price / 100).toFixed(2) }} €` |
| `const { localized } = useLocalized(); localized(p.translations, 'name')` | `p.translations[locale].name` (no fallback) |
| `<MzImage :src :alt ratio="4/3" />` | `<img src>` without size or alt |
| `<MzDate value="2027-01-15" />` | `new Date(d).toLocaleDateString()` (wrong time zone, SSR mismatch) |

## Themes and density

`MzThemeToggle` sets light / dark / system; an explicit choice is remembered and applies
everywhere, applied before the first paint (no flash). Without a choice, the public site is light
and the admin follows the system. The admin layout provides `compact` density: Mz components and
`useDensity().size` default to `sm` there.

## Checks

```bash
npm run lint         # ESLint + design-token guard
npm test             # unit (format, localisation, contrast) + component tests
npm run build && npm run test:e2e   # Playwright: fr/en/ar, theme, admin, axe, 360/768/1280 px
```

Node ≥ 24.11 is required: older Node versions ship time-zone data from before Morocco moved to
UTC+0 (20 September 2026) and show camp times one hour off (a unit test checks this).
