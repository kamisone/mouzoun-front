/** Section types that run full-bleed from the top of the page (their photo goes behind the header). */
export const HERO_SECTION_TYPES = ['hero', 'hero_slider']

/**
 * Lets the public header float, transparent with ivory text, over the page's opening hero photo
 * until the page scrolls. The page declares it with `<html data-header-overlay>`; the CSS in
 * main.css does the rest (`.mz-site-header`).
 *
 * An html attribute rather than shared state: during server rendering the header is rendered
 * before the page has loaded its sections, but head attributes are written after the whole page,
 * so the server HTML is always right (no flash, no jump when the page hydrates).
 */
export function useHeaderOverlay(on: MaybeRefOrGetter<boolean>) {
  useHead({ htmlAttrs: { 'data-header-overlay': () => (toValue(on) ? 'true' : undefined) } })
}
