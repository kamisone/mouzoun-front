/** Types of the shop API (`/v1/shop`, `/v1/admin/shop`). Money is integer cents. */

export type ShopStatus = 'closed' | 'catalog_only' | 'open'
export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder'
export type FulfillmentMethod = 'shipping' | 'relay_point' | 'pickup' | 'stay_delivery'
export type WithdrawalExemption = 'none' | 'perishable' | 'unsealed_hygiene' | 'personalised'

/** A carrier relay point (Mondial Relay, Colissimo). */
export interface RelayPoint {
  id: string
  carrier: string
  name: string
  line1: string
  postal_code: string
  city: string
  country_code: string
  opening_hours: string[]
}
export type PaymentMethod = 'stripe' | 'cash_on_delivery' | 'pay_at_pickup' | 'bank_transfer'

export interface ShopConfig {
  status: ShopStatus
  currency: string
  prices_include_tax: boolean
  payment_methods: PaymentMethod[]
  stripe_checkout_mode: 'hosted' | 'embedded'
  ships_to_countries: string[]
  stay_delivery_enabled: boolean
  stay_delivery_fee_minor: number
  withdrawal_days: number
  min_order_minor: number
  max_quantity_per_line: number
  route_prefix: Record<string, string>
  pickup_points: { id: string, name: string, instructions: string | null }[]
  fake_payments: boolean
  /** Methods the selling entity offers (a French company: shipping and relay points). */
  fulfillment_methods: FulfillmentMethod[]
  /** Final button text, stating the payment obligation (Consumer Code L221-14). */
  checkout_button_label: string
  /** Published revision of the terms of sale, sent back with the order. */
  terms_revision_id: string | null
  seller: { legal_name: string, legal_form: string, siren: string | null, address: string } | null
  /** Legal page slugs by key: cgv, notice, privacy, cookies, withdrawal, shipping. */
  legal_pages: Partial<Record<'cgv' | 'notice' | 'privacy' | 'cookies' | 'withdrawal' | 'shipping', string>>
  consumer_mediator: { name?: string, url?: string } | null
  refund_deadline_days: number
  legal_guarantee_years: number
  relay_carriers: string[]
}

export interface ShopCard {
  id: string
  slug: string
  name: string
  short_description: string | null
  product_type: string
  image_url: string | null
  image_blurhash: string | null
  price_min_minor: number
  price_max_minor: number
  compare_at_minor: number | null
  currency: string
  availability: Availability
  variant_count: number
  default_variant_id: string | null
  rating_avg: number | null
  rating_count: number
  is_featured: boolean
}

export interface ShopFacets {
  categories: { id: string, parent_id: string | null, name: string, slug: string, count: number }[]
  options: { key: string, option: string, label: string, count: number }[]
}

export interface ShopList {
  data: ShopCard[]
  total: number
  page: number
  per_page: number
  next_cursor: string | null
  facets: ShopFacets
}

export interface ShopCategory {
  id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  image_url: string | null
  seo_title: string | null
  seo_description: string | null
  slugs: Record<string, string> | null
}

export interface OptionValue { code: string, label: string, swatch_url: string | null, swatch_color?: string | null }
/** `display_type`: buttons, colour/image swatches or a dropdown (variation library, as in vitecamio). */
export interface ProductOption { code: string, name: string, display_type?: 'button' | 'swatch' | 'dropdown', default_value?: string | null, values: OptionValue[] }

export interface ShopVariant {
  id: string
  sku: string
  barcode: string | null
  is_default: boolean
  price_minor: number
  compare_at_price_minor: number | null
  /** Lowest price of the 30 days before the current one: what a reduction refers to. */
  reference_price_minor: number | null
  country_of_origin: string | null
  unit_price: { amount_minor: number, unit: 'kg' | 'l' | 'piece' } | null
  net_quantity: string | null
  net_unit: string | null
  weight_grams: number
  availability: Availability
  quantity_left: number | null
  max_quantity: number
  options: Record<string, string>
  media: { url: string }[]
}

export interface ShopProduct {
  id: string
  name: string
  slug: string
  subtitle: string | null
  short_description: string | null
  description: string | null
  seo: { title: string | null, description: string | null }
  product_type: string
  categories: { id: string, name: string, slug: string }[]
  currency: string
  options: ProductOption[]
  variants: ShopVariant[]
  gallery: { url: string, blurhash: string | null, alt: string | null, width: number | null, height: number | null }[]
  food: {
    is_perishable: boolean
    withdrawal_exemption: WithdrawalExemption
    allergens: string[]
    nutrition: Record<string, number | string> | null
    shelf_life_days: number | null
    lot_tracked: boolean
    ingredients: string | null
    storage_instructions: string | null
    usage_tips: string | null
    origin_story: string | null
    producer_name: string | null
    legal_notice: string | null
  }
  season: { from: string | null, until: string | null }
  origin_place: { name: string, slug: string | null } | null
  crop: { name: string, harvest_months: number[] } | null
  reviews: { average: number | null, count: number, latest: { author: string, rating: number, title: string | null, body: string | null, verified: boolean, date: string }[] }
  related: { id: string, name: string, slug: string, image_url: string | null, price_min_minor: number | null }[]
  slugs: Record<string, string>
  max_quantity: number
}

export type IssueCode =
  | 'out_of_stock' | 'quantity_limited' | 'not_shippable_to_country' | 'promotion_not_applicable' | 'below_min_order'
  | 'product_unavailable' | 'address_required' | 'fulfillment_required' | 'payment_method_unavailable' | 'empty_cart'

export interface Issue { code: IssueCode, line_id?: string, data?: Record<string, unknown> }

export interface Totals {
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  shipping_discount_minor: number
  tax_minor: number
  cod_fee_minor: number
  total_minor: number
  taxes_included: boolean
}

export interface ShippingOption {
  rate_id: string
  code: string
  name: string
  carrier: string | null
  amount_minor: number
  delivery_days_min: number | null
  delivery_days_max: number | null
  allows_cash_on_delivery: boolean
}

export interface ShippingLine {
  profile_id: string
  rate_id: string | null
  code: string
  name: string
  carrier: string | null
  amount_minor: number
  discount_minor: number
  allows_cash_on_delivery: boolean
  cod_fee_minor: number
  options: ShippingOption[]
}

export interface Address {
  first_name: string
  last_name: string
  company?: string | null
  line1: string
  line2?: string | null
  city: string
  region?: string | null
  postal_code?: string | null
  country_code: string
  phone: string
  delivery_notes?: string | null
}

export interface ShopCartItem {
  id: string
  variant_id: string
  product_id: string
  name: string
  slug: string
  options_label: string
  sku: string
  image_url: string | null
  quantity: number
  unit_price_minor: number
  compare_at_price_minor: number | null
  subtotal_minor: number
  discount_minor: number
  total_minor: number
  issues: Issue[]
}

export interface Cart {
  id: string | null
  currency: string
  items: ShopCartItem[]
  item_count: number
  email?: string | null
  fulfillment_method?: FulfillmentMethod | null
  shipping_address?: Address | null
  estimate_country?: string | null
  pickup_location_id?: string | null
  relay_point?: RelayPoint | null
  stay_booking?: boolean
  promotion_codes: string[]
  promotions: { promotion_id: string, code: string | null, amount_minor: number, shipping_amount_minor: number }[]
  shipping_lines: ShippingLine[]
  totals: Totals
  issues: Issue[]
  can_checkout: boolean
  payment_methods: PaymentMethod[]
}

export interface CheckoutResult {
  order: { order_id: string, number: string, payment_method: PaymentMethod, redirect_url: string | null, client_secret: string | null }
  access_token: string
}

export interface OrderItem {
  id: string
  sku: string
  quantity: number
  unit_price_minor: number
  total_minor: number
  name: string
  options_label: string | null
  image_url: string | null
  slug: string | null
  returnable: boolean
  withdrawal_exemption: WithdrawalExemption
  fulfilled_quantity: number
  returned_quantity: number
  refunded_quantity: number
}

export interface OrderView {
  id: string
  number: string
  status: 'draft' | 'pending' | 'open' | 'completed' | 'cancelled'
  payment_status: string
  fulfillment_status: string
  payment_method: PaymentMethod | null
  fulfillment_method: FulfillmentMethod
  requires_confirmation: boolean
  confirmed: boolean
  email: string
  phone: string | null
  locale: string
  currency: string
  shipping_address: Address | null
  pickup_location: { name: string, instructions: string | null } | null
  totals: Totals
  amount_paid_minor: number
  amount_refunded_minor: number
  placed_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  hold_until: string | null
  items: OrderItem[]
  fulfillments: { id: string, method: string, status: string, carrier: string | null, tracking_number: string | null, tracking_url: string | null, shipped_at: string | null, delivered_at: string | null, pickup_code: string | null }[]
  timeline: { kind: string, status: string | null, at: string }[]
  returns: { id: string, number: string, status: string, reason: string, requested_at: string }[]
  can_request_return: boolean
  return_until: string | null
  invoice_number: string | null
  bank_transfer_details: string | null
  payment_url: string | null
}
