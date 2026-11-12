import { describe, expect, it } from 'vitest'
import {
  centsToInput,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatTime,
  formatMoney,
  parseMoneyToCents,
  pickLocalized,
} from '../../app/utils/i18n-format'

// Intl output uses special spaces: normalise them to compare readable strings.
const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ').replace(/\u200F/g, '')

describe('formatMoney (cents → localized EUR)', () => {
  const cases: Array<[number, string, string, string]> = [
    // cents, fr, en, ar
    [0, '0,00 €', '€0.00', '0,00 €'],
    [99, '0,99 €', '€0.99', '0,99 €'],
    [100, '1,00 €', '€1.00', '1,00 €'],
    [100000, '1 000,00 €', '€1,000.00', '1.000,00 €'],
    [125050, '1 250,50 €', '€1,250.50', '1.250,50 €'],
  ]
  it.each(cases)('%i cents', (cents, fr, en, ar) => {
    expect(plain(formatMoney(cents, 'EUR', 'fr'))).toBe(fr)
    expect(plain(formatMoney(cents, 'EUR', 'en'))).toBe(en)
    expect(plain(formatMoney(cents, 'EUR', 'ar'))).toBe(ar)
  })

  it('handles negative amounts, other currencies and whole-euro display', () => {
    expect(plain(formatMoney(-250, 'EUR', 'en'))).toBe('-€2.50')
    expect(plain(formatMoney(4500, 'EUR', 'fr', { trimZeroCents: true }))).toBe('45 €')
    expect(plain(formatMoney(4550, 'EUR', 'fr', { trimZeroCents: true }))).toBe('45,50 €')
    expect(plain(formatMoney(5000, 'MAD', 'fr'))).toBe('50,00 MAD')
    expect(formatMoney(Number.NaN)).toBe('')
  })

  it('never drifts with floating point', () => {
    for (const cents of [1, 7, 29, 57, 101, 999999, 123456789]) {
      const back = parseMoneyToCents(plain(formatMoney(cents, 'EUR', 'en')))
      expect(back).toBe(cents)
    }
  })
})

describe('parseMoneyToCents (typed amount → cents)', () => {
  it.each([
    ['120', 12000],
    ['120,5', 12050],
    ['120.50', 12050],
    ['1 250,50', 125050],
    ['1,250.50', 125050],
    ['1.250', 125000],
    ['0,99', 99],
    ['€ 1 000', 100000],
    ['-3,2', -320],
  ])('%s → %i', (input, cents) => expect(parseMoneyToCents(input)).toBe(cents))

  it.each(['', 'abc', '12,345,6x', '1,2,3,4'])('rejects %j', input => expect(parseMoneyToCents(input)).toBeNull())

  it('round-trips through the input format', () => {
    expect(centsToInput(125050, 'fr')).toBe('1250,50')
    expect(centsToInput(99, 'en')).toBe('0.99')
    expect(centsToInput(null)).toBe('')
    expect(parseMoneyToCents(centsToInput(125050, 'fr'))).toBe(125050)
  })
})

describe('dates', () => {
  it('formats calendar dates without time-zone shifts', () => {
    expect(formatDate('2027-01-15', 'fr')).toBe('15 janvier 2027')
    expect(formatDate('2027-01-15', 'en')).toBe('15 January 2027')
    expect(formatDate('2027-01-15', 'ar')).toBe('15 يناير 2027')
    expect(formatDate('2027-01-15', 'fr', 'weekday')).toBe('vendredi 15 janvier 2027')
    expect(plain(formatDateRange('2027-01-15', '2027-01-17', 'fr'))).toMatch(/^15\s?–\s?17 janvier 2027$/)
    expect(formatDate('not a date')).toBe('')
  })

  // Morocco is on UTC+0 since 2026-09-20 01:00 UTC (tzdata 2026c); runtimes with older tz data
  // still say UTC+1. Camp times must be right on every runtime, whatever its tz data.
  it('shows instants in camp time, on any tz data (permanent UTC+0)', () => {
    expect(plain(formatDateTime('2027-01-15T08:00:00Z', 'fr'))).toBe('15 janvier 2027 à 08:00')
    expect(plain(formatDateTime('2027-01-15T08:00:00Z', 'en'))).toBe('15 January 2027 at 08:00')
    expect(formatTime('2027-07-15T17:30:00Z', 'fr')).toBe('17:30')
    expect(formatTime('2026-09-20T01:00:00Z', 'fr')).toBe('01:00')
  })
  it('keeps the past offsets (summer 2025 was UTC+1 in Morocco)', () => {
    expect(formatTime('2025-07-15T08:00:00Z', 'fr')).toBe('09:00')
    expect(formatTime('2026-09-20T00:30:00Z', 'fr')).toBe('01:30')
  })
})

describe('pickLocalized (API translations, field-by-field fallback)', () => {
  interface T { name: string, description: string | null }
  const translations = {
    fr: { name: 'Tente nomade', description: 'Tente berbère meublée' },
    en: { name: 'Nomad tent', description: '' },
    ar: { name: 'خيمة رحّل', description: null },
  }
  it('uses the current locale when the field is filled', () => {
    expect(pickLocalized<T, 'name'>(translations, 'name', 'en')).toBe('Nomad tent')
    expect(pickLocalized<T, 'name'>(translations, 'name', 'ar')).toBe('خيمة رحّل')
  })
  it('falls back to fr then en for empty or missing fields', () => {
    expect(pickLocalized<T, 'description'>(translations, 'description', 'en')).toBe('Tente berbère meublée')
    expect(pickLocalized<T, 'description'>(translations, 'description', 'ar')).toBe('Tente berbère meublée')
    expect(pickLocalized<T, 'name'>({ en: { name: 'Only English' } }, 'name', 'ar')).toBe('Only English')
    expect(pickLocalized<T, 'name'>({}, 'name', 'fr')).toBeUndefined()
    expect(pickLocalized<T, 'name'>(null, 'name', 'fr')).toBeUndefined()
  })
})
