# Mouzoun design system

Quiet, editorial, photography-led. Nuxt UI v4 (Tailwind CSS v4, Reka UI) themed with Mouzoun
tokens, plus `Mz` components that add domain meaning and the editorial section templates.
Live reference: **`/_styleguide`** (dev, or staff in production) — colours, type scale in Latin
and Arabic, space and shape, actions, every section template and component, LTR/RTL switch.
Before/after screenshots of the redesign: `docs/screenshots/{before,after}/`.

```
app/assets/css/main.css    tokens: palette scales, semantic colours, type scale, radius, shadow, motion
app/theme/palette.ts       brand colours (source of the scales)  →  npm run tokens
app/theme/colors.ts        Nuxt UI aliases → palettes
app/app.config.ts          global look of Nuxt UI components (once, never per usage)
app/components/{base,layout,marketing,forms,admin}/Mz*.vue
app/data/photos.json       site photos: variants, blur-up preview, credits (scripts/grade-photos.mjs)
```

## Principles

1. **Restraint.** 80 % of every screen is neutral + photography. One accent, used rarely.
2. **Space.** Sections breathe: 64–96 px on mobile, 96–160 px on desktop.
3. **Typography brands.** Large serif headlines, calm sans body, small uppercase tracked labels.
4. **Photography is the hero.** Full-bleed, warm and consistent. Text on photos only over a scrim.
5. **Precision.** 4/8 px spacing, 12-column grid, consistent radii, no random values.

## Colour

| Token (class) | Light | Dark | Use |
|---|---|---|---|
| `bg-default` | ivory #F7F3EC | #12100D | page |
| `bg-elevated` | #FFFDF9 | #1B1814 | inputs, cards, dialogs |
| `bg-muted` | sand #EDE6DA | #1B1814 | subtle sections, closing band |
| `border-default` | #E2D9CA | #2C2721 | hairlines |
| `text-highlighted` | ink #1C1915 | #F2ECE2 | headings |
| `text-muted` | #6B6258 | #A39886 | secondary text, labels |
| `text-primary`, `bg-primary` | terracotta #A4502F (hover #8C4227) | lighter terracotta | **only** primary CTA, links, focus ring, small highlights |
| `secondary` | deep olive #3E4A33 | | sparingly: tags, details |
| `success` `info` `warning` `error` | desaturated sage, dusk, ochre, clay | | forms and admin only |

Never: raw hex in components, saturated colours, pure #000/#FFF, gradients (except photo scrims),
the accent on large backgrounds. `tests/unit/contrast.spec.ts` checks every pair against WCAG AA
(4.5:1 text including placeholders, 3:1 UI), with the real values of `main.css`; axe checks the
rendered pages.

## Typography

| Class | Size (fluid 390 → 1440 px) | Face |
|---|---|---|
| `text-display-xl` | 56 → 104 | display serif, leading 1.05, tracking −0.02em |
| `text-display-lg` | 44 → 72 | display serif |
| `text-h1` / `text-h2` / `text-h3` | 36→56 / 28→40 / 22→28 | display serif |
| `text-body-lg` / `text-body` | 18→20 / 16→17 | sans, leading 1.6 |
| `text-small` / `text-caption` | 14 / 12 | sans |
| `eyebrow` | 12, uppercase, 0.14em, muted | sans 500 |

Latin: **Cormorant Garamond** (400/500) + **Inter** (400/500). Arabic: **Noto Naskh Arabic** +
**IBM Plex Sans Arabic**, swapped automatically for `lang="ar"` (page or fragment), with looser
leading and **no tracking or uppercase**. Headings 400–500, never bold 800/900, never all caps.
Large numbers use lining figures (`lining-nums`). Text columns max 680 px (`max-w-editorial`).

## Space, grid, shape

- Spacing: **4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160 px** (`1 2 3 4 6 8 12 16 24 32 40`).
  `npm run lint` rejects any other padding / margin / gap.
- Container 1280 px, gutters 24 px mobile / 48 px desktop (`MzContainer`), 12-column grid.
- Radius: 2 px inputs and buttons (`rounded-xs`), 4 px cards and images (`rounded-sm`), `rounded-full`
  only for pills and avatars.
- Shadows: none, except `shadow-overlay` for menus and dialogs. Depth comes from surfaces and
  hairlines.

## Actions

- **Primary**: `<UButton>` — solid accent, 48 px, Inter 500, slight tracking. **One per view.**
- **Secondary**: `<UButton color="neutral" variant="outline">` — 1 px ink outline.
- **Tertiary**: `<a class="link-underline text-small font-medium text-highlighted">` — underline
  that draws on hover.

## Section templates (`components/marketing`)

| Component | Use |
|---|---|
| `MzHero` | full-viewport photo/video, scrim, headline bottom-start, one CTA, scroll cue |
| `MzEditorialSplit` | image 6 cols + text 5 cols, alternate with `reverse` |
| `MzSection` + `MzGrid` + `MzOfferCard` | 3-up offers: image first (4:5 or 3:2), serif title, one meta line |
| `MzQuoteImage` | full-bleed photo with a serif quote |
| `MzFacts` | numbers row, serif, hairlines |
| `MzGallery` | horizontal scroll on mobile, editorial row on desktop, lightbox |
| `MzPracticalInfo` | map (loaded on demand, photo preview) + practical list |
| `MzCtaBanner` | closing band on the sand surface |

Header: transparent with ivory text over a hero (`definePageMeta({ headerOverlay: true })`),
solid ivory with a hairline after scrolling; centred wordmark; full-screen serif menu on mobile.
Footer: always dark.

## Imagery

- Always `MzImage`: fixed ratio (`16/9`, `3/2`, `4/5`, `1/1`) or `fill`, object-cover, blur-up,
  never stretched, `alt` required (translated: `photos.<slug>` in i18n).
- Site photos are prepared once by `node scripts/grade-photos.mjs <manifest.json>`: warm grade,
  WebP variants 480–2000 px served as static files (no image processing at request time), blur-up
  preview, credits. **The current photos are CC-licensed placeholders from Wikimedia Commons**
  (credits in the footer and `app/data/photos.json`); replace them with real photos of M'ssici.
- `sizes` always with breakpoints: `xs:100vw sm:50vw lg:33vw` (enforced by lint).
- No illustrations, emojis or clip-art. Icons: lucide, thin, small, never in every heading.

## Motion

`MzReveal`: fade + 16 px rise, 600 ms, `ease-editorial` (0.22, 1, 0.36, 1), 60 ms stagger; image
hover zoom 1.03 over 600 ms; header background 300 ms; full-screen menu fades. No bounce, spin
or parallax. Everything is off with `prefers-reduced-motion`.

## Adding a colour or a component

- **Colour**: add it to `BRAND_COLORS` in `app/theme/palette.ts` (base at 500, optional exact
  shades), run `npm run tokens`, map it in `app/theme/colors.ts` if it is a Nuxt UI alias, add the
  semantic overrides in `main.css` and its pairs to the contrast test.
- **Component**: style Nuxt UI globally in `app.config.ts`; create an `Mz` component only for
  domain meaning. Typed props/emits, slots, no data fetching, semantic tokens, logical utilities,
  spacing scale, keyboard accessible, density via `useDensity()`. Show it in `_styleguide.vue`.

## RTL rules

- Logical utilities only (`ms- me- ps- pe- start- end- text-start border-s`); physical ones fail lint.
- Directional icons flip (`rtl:rotate-180`); side panels compute their side from `useTextDirection()`.
- Numbers, phones, references, money inputs: `dir="ltr"`.
- Never letter-spacing or uppercase on Arabic (handled by the tokens and `eyebrow`).

## Do / Don't

| Do | Don't |
|---|---|
| `bg-muted text-muted border-default` | `bg-[#EDE6DA]`, `bg-orange-500`, `text-gray-500` |
| one primary `UButton` per view, others outline or `link-underline` | two solid accent buttons side by side |
| `<MzOfferCard>` image-first, no border | bordered card with shadow, icon tile and badges |
| `MzSection` with `eyebrow` + serif `title` | centred everything, icons in every heading |
| `<MzImage :srcset ratio="4/5" :alt>` | `<img>` without ratio or alt, stretched images |
| `py-24 lg:py-40`, `gap-6` | `py-[100px]`, `gap-5`, `p-7` |
| `ms-4`, `text-start` | `ml-4`, `text-left` |

## Checks

```bash
npm run lint         # ESLint + design-token guard (colours, palette classes, RTL, spacing, image sizes)
npm test             # unit (format, localisation, contrast) + component tests
npm run build && npm run test:e2e   # Playwright: fr/en/ar, theme, admin, axe, 360/768/1280 px
SCREENSHOTS=docs/screenshots/after npm run test:e2e -- screenshots   # review screenshots
```

Node ≥ 24.11 is required (older versions show Morocco's time one hour off).
