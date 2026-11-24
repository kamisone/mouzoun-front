import type { Address, Cart, CheckoutResult, FulfillmentMethod, OrderView, PaymentMethod, RelayPoint, ShopCategory, ShopCategoryPage, ShopConfig, ShopList, ShopProduct } from '~/utils/shop-types'

export interface ShopListQuery {
  category?: string
  min_price?: number
  max_price?: number
  in_stock?: boolean
  product_type?: string
  q?: string
  sort?: string
  options?: string
  page?: number
  per_page?: number
}

export interface FulfillmentBody {
  method: FulfillmentMethod
  shipping_address?: Address | null
  billing_address?: Address | null
  shipping_rate_ids?: string[]
  pickup_location_id?: string | null
  booking_reference?: string | null
  last_name?: string | null
  estimate_country?: string | null
  email?: string | null
  relay_point_id?: string | null
}

export interface ShopCheckoutBody {
  payment_method: PaymentMethod
  email: string
  phone?: string | null
  first_name?: string | null
  last_name?: string | null
  accept_terms: boolean
  /** The terms revision shown next to the checkbox (refused if it changed meanwhile). */
  terms_revision_id?: string | null
  marketing_consent?: boolean
  customer_note?: string | null
}

/**
 * Typed client of the public shop API. The cart travels in an HttpOnly cookie; during SSR the
 * visitor's cookies are forwarded (never the refresh token, see useBookingApi).
 */
export function useShopApi() {
  const nuxtApp = useNuxtApp()
  const locale = computed(() => (nuxtApp.$i18n as unknown as { locale: Ref<string> }).locale.value)
  const base = useApiBase()
  const raw = import.meta.server ? useRequestHeaders(['cookie']) : {}
  const cookie = raw.cookie?.split(';').filter(c => !/^\s*(__Host-)?mz_rt=/.test(c)).join(';')
  const http = $fetch.create({
    baseURL: `${base}/v1/shop`,
    credentials: 'include',
    onRequest({ options }) {
      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set('Accept-Language', locale.value)
      if (cookie) headers.set('cookie', cookie)
      options.headers = headers
    },
  })
  const access = (token?: string | null, email?: string | null) => ({ ...(token ? { t: token } : {}), ...(email ? { email } : {}) })

  return {
    config: () => http<ShopConfig>('/config'),
    products: (query: ShopListQuery) => http<ShopList>('/products', { query }),
    product: (slug: string) => http<ShopProduct>(`/products/by-slug/${encodeURIComponent(slug)}`),
    categories: () => http<{ data: ShopCategory[] }>('/categories'),
    category: (slug: string) => http<ShopCategoryPage>(`/categories/${encodeURIComponent(slug)}`),
    cart: {
      get: () => http<Cart>('/cart'),
      add: (variant_id: string, quantity: number) => http<Cart>('/cart/items', { method: 'POST', body: { variant_id, quantity } }),
      update: (id: string, quantity: number) => http<Cart>(`/cart/items/${id}`, { method: 'PATCH', body: { quantity } }),
      remove: (id: string) => http<Cart>(`/cart/items/${id}`, { method: 'DELETE' }),
      fulfillment: (body: FulfillmentBody) => http<Cart>('/cart/fulfillment', { method: 'PUT', body }),
      addCode: (code: string) => http<Cart>('/cart/promotions', { method: 'POST', body: { code } }),
      removeCode: (code: string) => http<Cart>(`/cart/promotions/${encodeURIComponent(code)}`, { method: 'DELETE' }),
    },
    checkout: (body: ShopCheckoutBody, idempotencyKey: string) =>
      http<CheckoutResult>('/checkout', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),
    order: (number: string, token?: string | null, email?: string | null) => http<OrderView>(`/orders/${encodeURIComponent(number)}`, { query: access(token, email) }),
    orderStatus: (number: string, token?: string | null) => http<{ status: string, payment_status: string, fulfillment_status: string }>(`/orders/${encodeURIComponent(number)}/status`, { query: access(token) }),
    relayPoints: (postal_code: string, carrier = 'mondial_relay', country = 'FR') => http<{ data: RelayPoint[] }>('/relay-points', { query: { postal_code, carrier, country } }),
    requestReturn: (number: string, token: string | null, body: { items: { order_item_id: string, quantity: number, still_sealed?: boolean | null }[], reason: string, note?: string }) =>
      http<{ return_id: string }>(`/orders/${encodeURIComponent(number)}/returns`, { method: 'POST', body, query: access(token) }),
    invoiceUrl: (number: string, token?: string | null) => `${base}/v1/shop/orders/${encodeURIComponent(number)}/invoice${token ? `?t=${token}` : ''}`,
    notifyStock: (variant_id: string, email: string) => http('/stock-notifications', { method: 'POST', body: { variant_id, email } }),
    notifyOpening: (email: string) => http('/notify-me', { method: 'POST', body: { email } }),
    fakePayment: (session: string, outcome: 'paid' | 'failed' | 'expired') => http(`/payments/fake/${session}/${outcome}`, { method: 'POST' }),
    account: {
      orders: () => http<{ data: { number: string, status: string, payment_status: string, fulfillment_status: string, total_minor: number, currency: string, placed_at: string | null, line_count: number, image_url: string | null }[] }>('/account/orders'),
      addresses: () => http<{ data: (Address & { id: string, label: string | null, is_default: boolean })[] }>('/account/addresses'),
      saveAddress: (body: Address & { label?: string | null, is_default?: boolean }, id?: string) =>
        http(id ? `/account/addresses/${id}` : '/account/addresses', { method: id ? 'PUT' : 'POST', body }),
      deleteAddress: (id: string) => http(`/account/addresses/${id}`, { method: 'DELETE' }),
    },
  }
}
