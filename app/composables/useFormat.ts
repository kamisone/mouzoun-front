import {
  type DateInput,
  type DateStyle,
  type Translations,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatTime,
  formatMoney,
  formatNumber,
  intlLocale,
  pickLocalized,
} from '~/utils/i18n-format'

/** `money(cents)` → "1 250,00 €" in the current locale. */
export function useMoney() {
  const { locale } = useI18n()
  return {
    money: (cents: number, currency = 'EUR', options?: { trimZeroCents?: boolean }) =>
      formatMoney(cents, currency, locale.value, options),
  }
}

/** Dates in the current locale and the camp's time zone. */
export function useDate() {
  const { locale } = useI18n()
  return {
    date: (value: DateInput, style?: DateStyle) => formatDate(value, locale.value, style),
    dateTime: (value: DateInput) => formatDateTime(value, locale.value),
    dateRange: (start: DateInput, end: DateInput) => formatDateRange(start, end, locale.value),
    time: (value: DateInput) => formatTime(value, locale.value),
  }
}

export function useNumber() {
  const { locale } = useI18n()
  return {
    number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale.value, options),
    percent: (ratio: number) => formatNumber(ratio, locale.value, { style: 'percent', maximumFractionDigits: 1 }),
  }
}

/** The BCP 47 locale of the current language (for Intl or `lang` attributes). */
export function useIntlLocale() {
  const { locale } = useI18n()
  return computed(() => intlLocale(locale.value))
}

/**
 * Translated database content (`translations: { fr: {...}, en: {...}, ar: {...} }`), with the
 * API's field-by-field fallback: current locale, then fr, then en.
 *
 * const { localized } = useLocalized()
 * localized(product.translations, 'name')
 */
export function useLocalized() {
  const { locale } = useI18n()
  return {
    localized: <T, K extends keyof T>(translations: Translations<T> | null | undefined, field: K) =>
      pickLocalized(translations, field, locale.value),
  }
}
