import type { Address, FulfillmentMethod, PaymentMethod } from '~/utils/shop-types'

export interface CheckoutForm {
  email: string
  phone: string
  first_name: string
  last_name: string
  method?: FulfillmentMethod
  address: Address
  pickup_location_id?: string
  relay_point_id?: string
  booking_reference: string
  booking_last_name: string
  payment_method?: PaymentMethod
  accept_terms: boolean
}

/**
 * A phone number in E.164 (`+33612345678`), or null when invalid: international numbers with
 * `+`/`00`, or national ones of France and Morocco (`06 12 34 56 78`). Mirrors the API.
 */
export function toE164(phone: string, country: string): string | null {
  let p = phone.replace(/[\s.\-()]/g, '')
  if (p.startsWith('00')) p = `+${p.slice(2)}`
  if (p.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(p) ? p : null
  if (!/^0\d{9}$/.test(p)) return null
  const prefix = ({ FR: '+33', MA: '+212' } as Record<string, string>)[country]
  return prefix ? `${prefix}${p.slice(1)}` : null
}

/** Field → error code (`required`, `invalid`, `not_shipped`). Order = the order fields appear in. */
export function validateCheckout(f: CheckoutForm, shipsTo: string[]): Record<string, string> {
  const e: Record<string, string> = {}
  const blank = (s: string | null | undefined) => !s || !s.trim()
  if (blank(f.email)) e.email = 'required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'invalid'
  const ships = f.method === 'shipping' || f.method === 'relay_point'
  if (!ships && blank(f.first_name)) e.first_name = 'required'
  if (f.phone && f.phone.replace(/\D/g, '').length < 6) e.phone = 'invalid'
  if (!f.method) e.method = 'required'
  if (f.method === 'relay_point' && blank(f.relay_point_id)) e.relay_point_id = 'required'
  if (ships) {
    const a = f.address
    for (const k of ['first_name', 'last_name', 'line1', 'city', 'phone'] as const) {
      if (blank(a[k])) e[`address.${k}`] = 'required'
    }
    if (blank(a.country_code)) e['address.country_code'] = 'required'
    else if (shipsTo.length && !shipsTo.includes(a.country_code)) e['address.country_code'] = 'not_shipped'
    if (a.country_code === 'FR' && blank(a.postal_code)) e['address.postal_code'] = 'required'
    else if ((a.country_code === 'MA' || a.country_code === 'FR') && a.postal_code && !/^\d{5}$/.test(a.postal_code.trim())) e['address.postal_code'] = 'invalid'
    if (!blank(a.phone) && !toE164(a.phone, a.country_code)) e['address.phone'] = 'invalid'
  }
  if (f.method === 'stay_delivery') {
    if (blank(f.booking_reference)) e.booking_reference = 'required'
    if (blank(f.booking_last_name)) e.booking_last_name = 'required'
  }
  if (f.payment_method === 'cash_on_delivery' && blank(f.phone) && blank(f.address.phone)) e.phone = 'required'
  if (!f.payment_method) e.payment_method = 'required'
  if (!f.accept_terms) e.accept_terms = 'required'
  return e
}

/** A new key per checkout attempt: a double click or a retry after a network error reuses it. */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
