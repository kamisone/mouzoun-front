import type { Paginated } from '~/utils/types'

/** Loose JSON object of the admin shop API (screens read the fields they show). */
export type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface AdminOrderRow {
  id: string
  number: string
  status: string
  payment_status: string
  fulfillment_status: string
  channel: string
  payment_method: string | null
  fulfillment_method: string
  total_minor: number
  currency: string
  placed_at: string | null
  created_at: string
  tags: string[]
  risk_level: string
  to_confirm: boolean
  email: string
  customer: string
  item_count: number
}

export interface AdminProductRow {
  id: string
  status: string
  is_featured: boolean
  product_type: string
  name: string
  slug: string
  image_url: string | null
  price_min_minor: number | null
  price_max_minor: number | null
  variant_count: number
  stock_total: number
  locales: string[] | null
  updated_at: string
}

type Query = Record<string, string | number | boolean | undefined | null>

/** Back-office shop endpoints (`/v1/admin/shop`), declared through `useAdminApi().shop`. */
export function shopAdminApi(http: ReturnType<typeof $fetch.create>) {
  const get = <T = Json>(path: string, query?: Query) => http<T>(`/shop${path}`, { query })
  const send = <T = Json>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
    http<T>(`/shop${path}`, { method, body: body as Record<string, unknown> })
  return {
    dashboard: () => get('/dashboard'),
    report: (query: Query) => get('/reports', query),
    reportCsvPath: '/shop/reports?format=csv',
    products: {
      list: (query: Query) => get<Paginated<AdminProductRow>>('/products', query),
      get: (id: string) => get(`/products/${id}`),
      create: (body: Json) => send('POST', '/products', body),
      update: (id: string, body: Json) => send('PUT', `/products/${id}`, body),
      remove: (id: string) => send('DELETE', `/products/${id}`),
      bulk: (body: { ids: string[], action: string, category_id?: string }) => send('POST', '/products/bulk', body),
      duplicate: (id: string) => send('POST', `/products/${id}/duplicate`),
      setOptions: (id: string, options: Json[]) => send('PUT', `/products/${id}/options`, options),
      generate: (id: string, body: { price_minor: number, weight_grams: number, sku_prefix?: string, reprice?: boolean }) => send('POST', `/products/${id}/variants/generate`, body),
      createVariant: (id: string, body: Json) => send('POST', `/products/${id}/variants`, body),
      bulkVariants: (id: string, patches: Json[]) => send('PATCH', `/products/${id}/variants`, patches),
      variantMedia: (variantId: string, media_ids: string[]) => send('PUT', `/variants/${variantId}/media`, { media_ids }),
      importCsv: (csv: string, dry_run: boolean) => send('POST', '/products/import', { csv, dry_run }),
      exportPath: '/shop/products/export.csv',
    },
    /** Variation library (vitecamio's variant attributes): reusable options with their values. */
    variations: {
      list: () => get<{ data: Json[] }>('/variations'),
      save: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/variations/${id}` : '/variations', body),
      remove: (id: string) => send('DELETE', `/variations/${id}`),
    },
    categories: {
      list: () => get<{ data: Json[] }>('/categories'),
      save: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/categories/${id}` : '/categories', body),
      remove: (id: string) => send('DELETE', `/categories/${id}`),
    },
    promotions: {
      list: () => get<{ data: Json[] }>('/promotions'),
      save: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/promotions/${id}` : '/promotions', body),
    },
    shipping: {
      get: () => get('/shipping'),
      saveProfile: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/shipping/profiles/${id}` : '/shipping/profiles', body),
      saveZone: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/shipping/zones/${id}` : '/shipping/zones', body),
      saveRate: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/shipping/rates/${id}` : '/shipping/rates', body),
      deleteRate: (id: string) => send('DELETE', `/shipping/rates/${id}`),
    },
    taxes: {
      list: () => get<{ data: Json[] }>('/taxes'),
      save: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/taxes/${id}` : '/taxes', body),
    },
    locations: {
      list: () => get<{ data: Json[] }>('/locations'),
      save: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/locations/${id}` : '/locations', body),
    },
    inventory: {
      grid: (query: Query) => get<Paginated<Json>>('/inventory', query),
      operate: (body: Json) => send('POST', '/inventory', body),
      lots: (query: Query) => get<{ data: Json[] }>('/lots', query),
      movements: (query: Query) => get<Paginated<Json>>('/movements', query),
      exportPath: '/shop/inventory/export.csv',
    },
    orders: {
      list: (query: Query) => get<Paginated<AdminOrderRow>>('/orders', query),
      get: (id: string) => get(`/orders/${id}`),
      annotate: (id: string, body: { message?: string, tags?: string[], internal_notes?: string, risk_level?: string }) => send('PATCH', `/orders/${id}`, body),
      confirm: (id: string) => send('POST', `/orders/${id}/confirm`),
      edit: (id: string, body: { lines: { variant_id: string, quantity: number }[], note?: string }) => send('PUT', `/orders/${id}/edit`, body),
      createDraft: (body: Json) => send('POST', '/orders/drafts', body),
      finalize: (id: string, body: { mode: string, paid?: boolean, provider?: string }) => send('POST', `/orders/${id}/finalize`, body),
      deleteDraft: (id: string) => send('DELETE', `/orders/${id}`),
      recordPayment: (id: string, body: { provider: string, amount_minor: number, reference?: string, note?: string }) => send('POST', `/orders/${id}/payments`, body),
      fulfill: (id: string, body: { location_id?: string, items?: { order_item_id: string, quantity: number }[] }) => send('POST', `/orders/${id}/fulfillments`, body),
      fulfillment: (fid: string, body: Json) => send('PATCH', `/fulfillments/${fid}`, body),
      cancel: (id: string, body: { reason: string, restock: boolean, refund: boolean, message?: string }) => send('POST', `/orders/${id}/cancel`, body),
      refund: (id: string, body: Json) => send('POST', `/orders/${id}/refunds`, body),
      createReturn: (id: string, body: Json) => send('POST', `/orders/${id}/returns`, body),
      resend: (id: string, template: string) => send('POST', `/orders/${id}/resend`, { template }),
      invoicePath: (id: string) => `/shop/orders/${id}/invoice`,
      packingSlipPath: (fid: string) => `/shop/fulfillments/${fid}/packing-slip`,
    },
    returns: {
      list: (query: Query) => get<Paginated<Json>>('/returns', query),
      update: (id: string, body: Json) => send('PATCH', `/returns/${id}`, body),
    },
    customerOrders: (id: string) => get(`/customers/${id}/orders`),
    // French operation: entities, VAT, compliance, accounting exports.
    france: {
      compliance: () => get<{ ok: boolean, items: { code: string, ok: boolean, detail: Json | null }[], oss: Json }>('/compliance'),
      entities: () => get<{ data: Json[] }>('/legal-entities'),
      saveEntity: (id: string, body: Json) => send('PUT', `/legal-entities/${id}`, body),
      invoicePreviewPath: (id: string) => `/shop/legal-entities/${id}/invoice-preview`,
      invoicePdfPath: (id: string) => `/shop/invoices/${id}/pdf`,
      taxRates: () => get<{ classes: Json[], rates: Json[], oss: Json }>('/tax-rates'),
      saveRate: (body: Json, id?: string) => send(id ? 'PUT' : 'POST', id ? `/tax-rates/${id}` : '/tax-rates', body),
      withdrawals: () => get<{ data: Json[] }>('/withdrawals'),
      exportPath: (kind: 'sales-journal' | 'documents' | 'stripe', from: string, to: string) => `/shop/exports/${kind}.csv?from=${from}&to=${to}`,
    },
    settings: {
      get: () => get('/settings'),
      update: (values: Json) => send('PATCH', '/settings', values),
      stripe: () => get('/settings/stripe'),
    },
  }
}
