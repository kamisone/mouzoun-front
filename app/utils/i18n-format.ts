/**
 * Locale-aware formatting through Intl only (pure functions; composables wrap them with the
 * current locale). Prices are integer cents, as stored by the API.
 */

/** App locale → BCP 47 locale used by Intl (Moroccan Arabic conventions, Western digits). */
export const INTL_LOCALES: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-MA' }

export function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale
}

/** 125000 → "1 250,00 €" (fr) · "€1,250.00" (en) · "1.250,00 €" (ar). */
export function formatMoney(cents: number, currency = 'EUR', locale = 'fr', options: { trimZeroCents?: boolean } = {}): string {
  if (!Number.isFinite(cents)) return ''
  const whole = Number.isInteger(cents / 100)
  const fraction = options.trimZeroCents && whole ? 0 : 2
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(cents / 100)
}

/**
 * Parses what a person types as an amount ("1 250,5", "1,250.50", "120") into integer cents,
 * without floating-point drift. Returns null when it is not an amount.
 */
export function parseMoneyToCents(input: string): number | null {
  const raw = input.replace(/[\s\u00A0\u202F€$£]|EUR|MAD|USD/gi, '').replace(/^\+/, '')
  if (!raw) return null
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw
  // The last "," or "." followed by 1–2 digits is the decimal separator; the others group.
  const decimal = body.match(/[.,](\d{1,2})$/)
  const grouped = decimal ? body.slice(0, -decimal[0].length) : body
  // Digits, optionally grouped by thousands ("1.250.000", "1,250", "1'250").
  if (!/^(?:\d+|\d{1,3}(?:[.,'’]\d{3})+)?$/.test(grouped) || (!grouped && !decimal)) return null
  const intPart = grouped.replace(/[.,'’]/g, '')
  // "1.250" (3 digits after the separator) is a thousands group, never 1.25: handled above,
  // since only 1–2 trailing digits are read as decimals.
  const cents = Number(intPart || '0') * 100 + (decimal ? Number(decimal[1]!.padEnd(2, '0')) : 0)
  if (!Number.isSafeInteger(cents)) return null
  return negative ? -cents : cents
}

/** Major units for an input field ("1250,5" stays editable): 125050 → "1250,50" (fr) / "1250.50" (en). */
export function centsToInput(cents: number | null | undefined, locale = 'fr'): string {
  if (cents == null || !Number.isFinite(cents)) return ''
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const sep = locale === 'en' ? '.' : ','
  return `${sign}${Math.trunc(abs / 100)}${sep}${String(abs % 100).padStart(2, '0')}`
}

export type DateInput = string | number | Date

/** "2027-01-15" is a calendar date (no time zone shift); anything else is an instant. */
export function toDate(value: DateInput): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number]
    return new Date(Date.UTC(y, m - 1, d, 12))
  }
  return new Date(value)
}

const isCalendarDate = (value: DateInput) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Dates and times are shown in the camp's time zone. */
export const CAMP_TIME_ZONE = 'Africa/Casablanca'

export type DateStyle = 'long' | 'medium' | 'short' | 'weekday'

export function formatDate(value: DateInput, locale = 'fr', style: DateStyle = 'long'): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const options: Intl.DateTimeFormatOptions = {
    timeZone: isCalendarDate(value) ? 'UTC' : CAMP_TIME_ZONE,
    ...(style === 'weekday'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { dateStyle: style }),
  }
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date)
}

export function formatDateTime(value: DateInput, locale = 'fr'): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: CAMP_TIME_ZONE,
    dateStyle: 'long',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(date)
}

export function formatDateRange(start: DateInput, end: DateInput, locale = 'fr'): string {
  const [a, b] = [toDate(start), toDate(end)]
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: isCalendarDate(start) ? 'UTC' : CAMP_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return fmt.formatRange(a, b)
}

export function formatNumber(value: number, locale = 'fr', options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value)
}

/** Translations as stored by the API: `{ fr: { name, ... }, en: { ... }, ar: { ... } }`. */
export type Translations<T> = Partial<Record<string, Partial<T> | null | undefined>>

/**
 * The value of `field` in `locale`, falling back field by field (fr, then en, like the API):
 * empty strings count as missing.
 */
export function pickLocalized<T, K extends keyof T>(
  translations: Translations<T> | null | undefined,
  field: K,
  locale: string,
  fallbacks: readonly string[] = ['fr', 'en'],
): T[K] | undefined {
  if (!translations) return undefined
  for (const code of [locale, ...fallbacks.filter(f => f !== locale)]) {
    const value = translations[code]?.[field]
    if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')) {
      return value as T[K]
    }
  }
  return undefined
}
