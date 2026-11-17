import { describe, expect, it } from 'vitest'
import { type CheckoutForm, toE164, validateCheckout } from '../../app/utils/shop-checkout'

const base = (): CheckoutForm => ({
  email: 'amina@example.com', phone: '', first_name: 'Amina', last_name: '', method: 'pickup',
  address: { first_name: '', last_name: '', line1: '', city: '', country_code: 'MA', phone: '' },
  pickup_location_id: 'p1', booking_reference: '', booking_last_name: '', payment_method: 'pay_at_pickup', accept_terms: true,
})

describe('checkout form validation', () => {
  it('accepts a complete pickup order', () => {
    expect(validateCheckout(base(), ['MA'])).toEqual({})
  })

  it('requires the email, terms, a delivery and a payment method', () => {
    const f = { ...base(), email: 'nope', accept_terms: false, method: undefined, payment_method: undefined }
    expect(validateCheckout(f, ['MA'])).toEqual({ email: 'invalid', accept_terms: 'required', method: 'required', payment_method: 'required' })
  })

  it('checks the address for home delivery, by country', () => {
    const f = { ...base(), method: 'shipping' as const, address: { first_name: 'A', last_name: 'B', line1: 'Rue 1', city: 'Rissani', country_code: 'MA', phone: '+212600000000', postal_code: '52A' } }
    expect(validateCheckout(f, ['MA'])).toEqual({ 'address.postal_code': 'invalid' })
    f.address.postal_code = '52450'
    f.address.country_code = 'FR'
    expect(validateCheckout(f, ['MA'])).toEqual({ 'address.country_code': 'not_shipped' })
    f.address.city = ''
    expect(validateCheckout(f, [])).toEqual({ 'address.city': 'required' })
  })

  it('asks for the booking for a tent delivery and a phone for cash on delivery', () => {
    expect(validateCheckout({ ...base(), method: 'stay_delivery' }, [])).toEqual({ booking_reference: 'required', booking_last_name: 'required' })
    expect(validateCheckout({ ...base(), payment_method: 'cash_on_delivery' }, [])).toEqual({ phone: 'required' })
  })
})

describe('French checkout rules', () => {
  const paris = { first_name: 'Claire', last_name: 'Martin', line1: '12 rue Oberkampf', city: 'Paris', country_code: 'FR', phone: '06 12 34 56 78', postal_code: '75011' }

  it('normalizes phones to E.164', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678')
    expect(toE164('0033 6 12 34 56 78', 'FR')).toBe('+33612345678')
    expect(toE164('0612345678', 'MA')).toBe('+212612345678')
    expect(toE164('12', 'FR')).toBeNull()
    expect(toE164('0612345678', 'DE')).toBeNull()
  })

  it('needs a 5-digit postal code in France', () => {
    const f = { ...base(), method: 'shipping' as const, address: { ...paris, postal_code: '' } }
    expect(validateCheckout(f, ['FR'])).toEqual({ 'address.postal_code': 'required' })
    f.address.postal_code = '7501'
    expect(validateCheckout(f, ['FR'])).toEqual({ 'address.postal_code': 'invalid' })
  })

  it('needs a relay point and the address for relay delivery', () => {
    const f: CheckoutForm = { ...base(), method: 'relay_point', address: { ...paris } }
    expect(validateCheckout(f, ['FR'])).toEqual({ relay_point_id: 'required' })
    f.relay_point_id = 'mondial_relay:75011-1'
    expect(validateCheckout(f, ['FR'])).toEqual({})
  })
})
