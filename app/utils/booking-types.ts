/** Types of the public booking API (`/v1/...`, see back/docs/booking/README.md). Amounts are cents. */

export type ProductKind = 'accommodation' | 'activity' | 'extra' | 'package'
export type PaymentOption = 'full' | 'deposit' | 'on_site'
export type BookingStatus = 'draft' | 'pending' | 'awaiting_payment' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show' | 'expired'

export interface GuestCount { guest_category_id: string, count: number }

export interface GuestCategory {
  id: string
  code: string
  name: string
  description: string | null
  min_age: number | null
  max_age: number | null
  counts_toward_capacity: boolean
}

export interface MediaRef { id: string, url: string, width: number | null, height: number | null, blurhash: string | null, alt: string | null }

export interface ProductCard {
  id: string
  kind: ProductKind
  slug: string
  name: string
  subtitle: string | null
  short_description: string | null
  booking_mode: 'instant' | 'on_request' | 'not_bookable'
  is_featured: boolean
  cover: MediaRef | null
  from_price_minor: number | null
  from_price_unit: string | null
  rating: { average: number, count: number } | null
  facts: Record<string, unknown> & {
    max_guests?: number | null
    surface_m2?: string | null
    min_nights?: number | null
    duration_minutes?: number | null
    difficulty?: string | null
    min_age?: number | null
    scheduling_mode?: string | null
    guide_languages?: string[] | null
    duration_days?: number | null
    duration_nights?: number | null
    amenities?: string[]
    beds?: { type: string, count: number }[] | null
    accommodation_kind?: string | null
  }
}

export interface ProductPage extends ProductCard {
  description: string | null
  highlights: string[]
  included: string[]
  not_included: string[]
  what_to_bring: string[]
  requirements: string | null
  important_info: string | null
  seo_title: string | null
  seo_description: string | null
  alternates: { locale: string, slug: string }[]
  gallery: MediaRef[]
  amenities: { code: string, group: string, icon: string | null, name: string, description: string | null }[]
  accommodation: null | {
    accommodation_kind: string
    inventory_mode: 'unit' | 'pool'
    max_guests: number
    max_adults: number | null
    max_children: number | null
    standard_occupancy: number
    beds: { type: string, count: number }[]
    surface_m2: string | null
    min_nights: number
    max_nights: number | null
    check_in_from: string | null
    check_in_until: string | null
    check_out_until: string | null
    pitch_selection_extra_id: string | null
  }
  activity: null | {
    scheduling_mode: 'fixed_slots' | 'on_request' | 'anytime'
    duration_minutes: number | null
    difficulty: string | null
    min_participants: number
    max_participants: number | null
    min_age: number | null
    is_guided: boolean
    guide_languages: string[]
    booking_cutoff_hours: number
    pickup_available: boolean
    standalone_bookable: boolean
    location_type: string
  }
  package: null | {
    duration_days: number | null
    duration_nights: number | null
    pricing_mode: string
    discount_percent: string
    items: { product_id: string, kind: ProductKind, name: string | null, slug: string | null, quantity: number, day_number: number | null, is_optional: boolean }[]
  }
  itinerary: { day: number, duration_minutes: number | null, title: string | null, description: string | null }[]
  extras: { product_id: string, name: string | null, description: string | null, mandatory: boolean, requires_date: boolean, max_quantity: number | null, price_minor: number | null, price_unit: string | null }[]
  units: { id: string, code: string, name: string | null, map_x: string | null, map_y: string | null }[]
  place: null | { name: string | null, latitude: string | null, longitude: string | null, distance_km: string | null, directions: string | null, is_meeting_point: boolean }
  reviews: { id: string, author_name: string, author_country: string | null, rating: number, title: string | null, body: string | null, experience_date: string | null, verified: boolean, reply: string | null, created_at: string }[]
  faqs: { question: string, answer: string }[]
  related: ProductCard[]
}

export interface BookingConfig {
  enabled: boolean
  site_live: boolean
  currency: string
  hold_minutes: number
  request_answer_hours: number
  balance_due_days: number
  balance_auto_charge: boolean
  max_days_ahead: number
  standalone_activities: boolean
  calendar_show_prices: boolean
  urgency_threshold: number
  self_service_changes: boolean
  guest_cancellation: boolean
  pitch_selection: boolean
  terms_version: string
  payments: Record<string, { publishable_key?: string, fake?: boolean }>
  providers: string[]
  captcha: boolean
}

export interface CalendarDay {
  date: string
  available: boolean
  remaining: number
  closed_to_arrival: boolean
  closed_to_departure: boolean
  min_nights: number
  price_minor: number | null
}

export interface AvailabilityCalendar {
  product_id: string | null
  currency: string
  min_nights: number
  max_nights: number | null
  check_in_from: string | null
  check_out_until: string | null
  days: CalendarDay[]
}

export interface Slot {
  id: string
  starts_at: string
  ends_at: string
  date: string
  remaining: number
  capacity: number
  state: 'open' | 'full' | 'too_late' | 'closed'
  language: string | null
}

export interface SlotsResponse {
  product_id: string
  scheduling_mode: 'fixed_slots' | 'on_request' | 'anytime'
  booking_cutoff_hours: number
  min_participants: number
  max_participants: number | null
  min_age: number | null
  guide_languages: string[]
  duration_minutes: number | null
  slots: Slot[]
}

/** One requested item (`kind` tagged, like the API). */
export type TripItem =
  | { kind: 'stay', product_id: string, arrival: string, departure: string, quantity?: number, guests: GuestCount[], unit_ids?: string[] }
  | { kind: 'activity', product_id: string, slot_id?: string | null, date?: string | null, time?: string | null, guests: GuestCount[], quantity?: number, language?: string | null }
  | { kind: 'extra', product_id: string, parent?: number | null, date?: string | null, quantity?: number }
  | { kind: 'package', product_id: string, arrival: string, guests: GuestCount[] }

export interface ItemIssue { code: string, message: string, details?: Record<string, unknown> }

export interface PriceLine {
  date: string
  season_id: string | null
  price_id: string
  unit: string
  kind: 'base' | 'extra_guest'
  guest_category_id: string | null
  quantity: number
  unit_amount_minor: number
  amount_minor: number
}

export interface AppliedDiscount { promotion_id: string, code: string | null, name: string | null, amount_minor: number }
export interface TaxLine { tax_id: string, code: string, amount_minor: number, inclusive: boolean }

export interface QuotedItem {
  index: number
  request_index: number | null
  parent_index: number | null
  kind: ProductKind
  product_id: string
  name: string
  slug: string | null
  mandatory: boolean
  in_package: boolean
  on_request: boolean
  quantity: number
  guests: GuestCount[]
  arrival: string | null
  departure: string | null
  date: string | null
  starts_at: string | null
  ends_at: string | null
  slot_id: string | null
  time: string | null
  language: string | null
  unit_ids: string[]
  remaining: number | null
  lines: PriceLine[]
  subtotal_minor: number
  discount_minor: number
  discounts: AppliedDiscount[]
  tax_minor: number
  included_tax_minor: number
  taxes: TaxLine[]
  total_minor: number
  issue: ItemIssue | null
}

export interface PaymentChoice { option: PaymentOption, due_now_minor: number, due_later_minor: number, due_later_on: string | null }
export interface CancellationStep { refund_percent: number, until: string | null }

export interface TripQuote {
  currency: string
  items: QuotedItem[]
  rate_plan: null | { id: string, code: string, name: string | null, meal_plan: string, payment_mode: string }
  subtotal_minor: number
  discount_minor: number
  discounts: AppliedDiscount[]
  tax_minor: number
  included_tax_minor: number
  total_minor: number
  payment_options: PaymentChoice[]
  is_request: boolean
  instant_confirmation: boolean
  cancellation: CancellationStep[]
  promo: null | { code: string, status: 'applied' | 'invalid' | 'not_combinable', reason: string | null }
  starts_on: string | null
  ends_on: string | null
  has_issues: boolean
}

export interface QuoteResponse { quote: TripQuote, quote_token: string | null }

export interface CartItem { id: string, parent_id: string | null, kind: TripItem['kind'], product_id: string, [key: string]: unknown }

export interface CartNotice {
  item_id: string
  code: 'price_changed' | 'unavailable'
  name: string
  old_minor: number | null
  new_minor: number | null
  issue: ItemIssue | null
}

export interface CartView {
  items: CartItem[]
  count: number
  quote: TripQuote | null
  quote_token: string | null
  notices: CartNotice[]
  added_id?: string
}

export interface SearchOption {
  rate_plan: TripQuote['rate_plan']
  total_minor: number
  subtotal_minor: number
  discount_minor: number
  discounts: AppliedDiscount[]
  tax_minor: number
  included_tax_minor: number
  per_night_minor: number
  payment_options: PaymentChoice[]
  cancellation: CancellationStep[]
  is_request: boolean
  items: QuotedItem[]
  remaining: number | null
}

export interface SearchResult {
  product: ProductCard
  available: boolean
  quantity: number
  nights: number
  issue: ItemIssue | null
  options: SearchOption[]
  nearest: { arrival: string, departure: string } | null
}

export interface SearchResponse { arrival: string, departure: string, nights: number, urgency_threshold: number, results: SearchResult[] }

export interface StartedPayment { payment_id: string, provider: string, client_secret: string, amount_minor: number, currency: string }

export interface CheckoutResponse {
  booking: { reference: string, status: BookingStatus, total_minor: number, due_now_minor: number, payment_option: PaymentOption, hold_expires_at: string | null, currency: string }
  access_token: string
  payment: StartedPayment | null
  payment_config: BookingConfig['payments']
}

export interface BookingItemView {
  id: string
  parent_id: string | null
  product_id: string
  kind: ProductKind
  status: 'active' | 'cancelled'
  quantity: number
  arrival: string | null
  departure: string | null
  starts_at: string | null
  ends_at: string | null
  name: string | null
  slug: string | null
  mandatory: boolean | null
  in_package: boolean | null
  check_in_from: string | null
  check_out_until: string | null
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  discounts: AppliedDiscount[] | null
  taxes: TaxLine[] | null
  lines: PriceLine[]
  language: string | null
  requested_time: string | null
  units: string[]
  guests: Record<string, number>
}

export interface BookingView {
  id?: string
  reference: string
  status: BookingStatus
  locale: string
  currency: string
  arrival: string | null
  departure: string | null
  party: { adults: number, children: number, infants: number }
  created_at: string
  confirmed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  hold_expires_at: string | null
  customer: { first_name: string, last_name: string | null, email: string | null, phone: string | null, country_code: string | null, [key: string]: unknown }
  estimated_arrival_time: string | null
  special_requests: string | null
  rate_plan: { code: string | null, meal_plan: string | null }
  items: BookingItemView[]
  totals: {
    subtotal_minor: number
    discount_minor: number
    tax_minor: number
    total_minor: number
    paid_minor: number
    balance_minor: number
    deposit_due_minor: number
    due_now_minor: number
    balance_due_on: string | null
  }
  payment_option: PaymentOption | null
  balance_collection: 'saved_card' | 'payment_link' | 'on_site' | null
  card_saved: boolean
  payments: { id: string, provider: string, purpose: string, status: string, amount_minor: number, refunded_minor: number, paid_at: string | null, created_at: string }[]
  starts_at: string | null
  cancellation: CancellationStep[]
  precheckin_completed: boolean
  can: { pay: boolean, cancel: boolean, edit: boolean, precheckin: boolean }
}

export interface CancellationPreview {
  allowed: boolean
  blocked_reason: 'status' | 'started' | 'disabled' | null
  total_minor: number
  paid_minor: number
  fee_minor: number
  refund_minor: number
  items: { item_id: string, name: string, starts_at: string | null, total_minor: number, refund_percent: number, fee_minor: number }[]
}

export interface RegisterGuest {
  id?: string
  first_name: string
  last_name: string
  nationality: string | null
  date_of_birth: string | null
  id_document_type: 'passport' | 'national_id' | 'residence_permit' | 'driving_licence' | 'other' | null
  id_document_number?: string | null
  has_id_document?: boolean
  guest_category_id?: string | null
  is_lead: boolean
}

/** Error body of every API failure. */
export interface ApiError { error: { code: string, message?: string, details?: Record<string, unknown> | string | null } }
