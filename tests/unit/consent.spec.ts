import { describe, expect, it } from 'vitest'
import { CONSENT_TTL_MS, consentState } from '../../app/utils/consent'

describe('cookie consent', () => {
  const now = Date.parse('2026-11-17T12:00:00Z')
  const at = (msAgo: number) => new Date(now - msAgo).toISOString()

  it('keeps a choice for 6 months, then asks again', () => {
    expect(consentState('granted', at(1000), now)).toBe('granted')
    expect(consentState('denied', at(CONSENT_TTL_MS - 1000), now)).toBe('denied')
    expect(consentState('granted', at(CONSENT_TTL_MS + 1000), now)).toBeNull()
  })

  it('treats anything else as not asked', () => {
    expect(consentState(null, null, now)).toBeNull()
    expect(consentState('granted', null, now)).toBeNull()
    expect(consentState('yes', at(1000), now)).toBeNull()
    expect(consentState('granted', 'garbage', now)).toBeNull()
  })
})
