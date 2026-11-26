import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Translated strings for test locators (dialog and region names...), read from the app's own
 * locale files, so a wording change in `i18n/locales/*.json` never breaks a test silently.
 * Placeholders (`{n}`) are replaced from `values`; plural forms take the first one.
 */
export type TestLocale = 'fr' | 'en' | 'ar'

const cache = new Map<TestLocale, Record<string, unknown>>()
function messages(locale: TestLocale) {
  if (!cache.has(locale)) {
    const file = fileURLToPath(new URL(`../i18n/locales/${locale}.json`, import.meta.url))
    cache.set(locale, JSON.parse(readFileSync(file, 'utf8')))
  }
  return cache.get(locale)!
}

export function tr(locale: TestLocale, key: string, values: Record<string, string | number> = {}): string {
  const found = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages(locale))
  if (typeof found !== 'string') throw new Error(`no ${locale} translation for ${key}`)
  return found.split(' | ')[0]!.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`))
}

/** The locale a Playwright project runs in (`ar-mobile` → ar, otherwise French). */
export const projectLocale = (projectName: string): TestLocale => (projectName.startsWith('ar') ? 'ar' : 'fr')
