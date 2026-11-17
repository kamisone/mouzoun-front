import { describe, expect, it } from 'vitest'
import { applyTranslations, summarizeErrors } from '../../app/utils/translate-generate'

describe('generated translations', () => {
  it('fill the other locales without blanking what exists', () => {
    const target = { fr: { name: 'Dattes' }, en: { name: '', subtitle: 'Kept' }, ar: { name: 'قديم' } }
    const changed = applyTranslations(target, {
      result: { en: { name: 'Dates', subtitle: '' }, ar: { name: '' } },
      errors: { ar: 'rate limited' },
    })
    expect(changed).toBe(1)
    expect(target).toEqual({ fr: { name: 'Dattes' }, en: { name: 'Dates', subtitle: 'Kept' }, ar: { name: 'قديم' } })
  })

  it('summarize the failed languages', () => {
    expect(summarizeErrors({})).toBeNull()
    expect(summarizeErrors({ ar: 'rate limited', en: 'rate limited' })).toBe('AR, EN: rate limited')
  })
})
