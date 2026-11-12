import type {
  AvailabilityCalendar,
  BookingConfig,
  BookingView,
  CancellationPreview,
  CartView,
  CheckoutResponse,
  GuestCategory,
  PaymentOption,
  ProductCard,
  ProductKind,
  ProductPage,
  QuoteResponse,
  RegisterGuest,
  SearchResponse,
  SlotsResponse,
  StartedPayment,
  TripItem,
} from '~/utils/booking-types'

export interface CheckoutBody {
  quote_token: string
  customer: { first_name: string, last_name: string, email: string, phone?: string, country_code?: string, whatsapp_preferred?: boolean }
  payment_option: PaymentOption
  provider?: string
  save_card?: boolean
  estimated_arrival_time?: string | null
  special_requests?: string | null
  accept_terms: boolean
  marketing_consent?: boolean
  captcha_token?: string | null
}

/**
 * Typed client of the public booking API: every call is declared here. The response language
 * follows the page (`Accept-Language`); the basket travels in an HttpOnly cookie.
 */
export function useBookingApi() {
  const { locale } = useI18n()
  const base = useApiBase()
  // During SSR, forward the visitor's cookies (the basket) to the API.
  const forwarded = import.meta.server ? useRequestHeaders(['cookie']) : {}
  const http = $fetch.create({
    baseURL: `${base}/v1`,
    credentials: 'include',
    onRequest({ options }) {
      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set('Accept-Language', locale.value)
      if (forwarded.cookie) headers.set('cookie', forwarded.cookie)
      options.headers = headers
    },
  })
  const key = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
  const withToken = (token: string) => ({ 'X-Booking-Token': token })

  return {
    config: () => http<BookingConfig>('/booking/config'),
    products: (query: { kind?: ProductKind, featured?: boolean } = {}) => http<ProductCard[]>('/catalog/products', { query }),
    product: (slug: string) => http<ProductPage>(`/catalog/products/${encodeURIComponent(slug)}`),
    guestCategories: () => http<GuestCategory[]>('/catalog/guest-categories'),
    calendar: (query: { product_id?: string, from: string, to: string }) => http<AvailabilityCalendar>('/availability/calendar', { query }),
    search: (body: { arrival: string, departure: string, guests: { guest_category_id: string, count: number }[], child_ages?: number[], promo_code?: string }) =>
      http<SearchResponse>('/availability/search', { method: 'POST', body }),
    slots: (query: { product_id: string, from: string, to: string }) => http<SlotsResponse>('/availability/slots', { query }),
    quote: (body: { items: TripItem[], rate_plan_id?: string | null, promo_code?: string | null, child_ages?: number[] }) =>
      http<QuoteResponse>('/quote', { method: 'POST', body }),

    cart: {
      get: () => http<CartView>('/cart'),
      add: (item: TripItem & { parent_id?: string | null }) => http<CartView>('/cart/items', { method: 'POST', body: item }),
      update: (id: string, item: TripItem & { parent_id?: string | null }) => http<CartView>(`/cart/items/${id}`, { method: 'PATCH', body: item }),
      remove: (id: string) => http<CartView>(`/cart/items/${id}`, { method: 'DELETE' }),
      options: (body: { promo_code?: string, rate_plan_id?: string | null, child_ages?: number[] }) => http<CartView>('/cart', { method: 'PUT', body }),
      clear: () => http<CartView>('/cart', { method: 'DELETE' }),
    },

    /** Books the basket. One Idempotency-Key per attempt: a double click never books twice. */
    checkout: (body: CheckoutBody, idempotencyKey = key()) =>
      http<CheckoutResponse>('/checkout', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),

    booking: {
      get: (reference: string, token: string) => http<BookingView>(`/bookings/${reference}`, { headers: withToken(token) }),
      status: (reference: string, token: string) =>
        http<{ status: string, paid_minor: number, total_minor: number, hold_expires_at: string | null, payment_status: string | null, failure_reason: string | null }>(
          `/bookings/${reference}/status`, { headers: withToken(token) }),
      pay: (reference: string, token: string, provider?: string) =>
        http<{ payment: StartedPayment, payment_config: BookingConfig['payments'] }>(`/bookings/${reference}/pay`, {
          method: 'POST', body: { provider }, headers: { ...withToken(token), 'Idempotency-Key': key() },
        }),
      cancellation: (reference: string, token: string) => http<CancellationPreview>(`/bookings/${reference}/cancellation`, { headers: withToken(token) }),
      cancel: (reference: string, token: string, reason?: string) =>
        http<{ refund_minor: number }>(`/bookings/${reference}/cancel`, { method: 'POST', body: { reason }, headers: withToken(token) }),
      update: (reference: string, token: string, body: { estimated_arrival_time: string | null, special_requests: string | null }) =>
        http<BookingView>(`/bookings/${reference}`, { method: 'PATCH', body, headers: withToken(token) }),
      guests: (reference: string, token: string) =>
        http<{ guests: RegisterGuest[], id_numbers_enabled: boolean }>(`/bookings/${reference}/guests`, { headers: withToken(token) }),
      saveGuests: (reference: string, token: string, guests: RegisterGuest[]) =>
        http<{ complete: boolean }>(`/bookings/${reference}/guests`, { method: 'PUT', body: { guests }, headers: withToken(token) }),
      find: (body: { reference: string, email: string, captcha_token?: string | null }) => http<{ sent: boolean }>('/bookings/find', { method: 'POST', body }),
      redeem: (reference: string, token: string) => http<{ access_token: string }>(`/bookings/${reference}/access`, { method: 'POST', body: { token } }),
      icsUrl: (reference: string, token: string) => `${base}/v1/bookings/${reference}/calendar.ics?t=${encodeURIComponent(token)}`,
    },

    /** Development / tests only (PAYMENTS_FAKE): plays the payment provider. */
    fakePayment: (paymentId: string, outcome: 'succeed' | 'fail') => http(`/payments/fake/${paymentId}/${outcome}`, { method: 'POST' }),
  }
}

/** The stable error code of an API failure (`not_available`, `price_changed`...). */
export function apiErrorCode(error: unknown): string {
  const data = (error as { data?: { error?: { code?: string } } })?.data
  return data?.error?.code ?? 'network_error'
}

export function apiErrorDetails<T = Record<string, unknown>>(error: unknown): T | undefined {
  return (error as { data?: { error?: { details?: T } } })?.data?.error?.details
}
