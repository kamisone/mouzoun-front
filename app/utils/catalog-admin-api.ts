import type { TripQuote } from '~/utils/booking-types'

/**
 * Back office of what guests book (`/v1/admin/catalog/...`): stays, activities, packages and
 * extras, their units, calendar, schedules, departures, items, prices and the shared pricing
 * settings. Money is integer cents; percentages are decimal strings (`"12.5"`).
 */
export type CatalogKind = 'stays' | 'activities' | 'packages' | 'extras'
export const CATALOG_KINDS: CatalogKind[] = ['stays', 'activities', 'packages', 'extras']
export const CATALOG_LOCALES = ['fr', 'en', 'ar'] as const
export type CatalogLocale = typeof CATALOG_LOCALES[number]

export interface CatalogTranslation {
  name: string
  slug: string
  subtitle: string | null
  short_description: string | null
  description: string | null
  highlights: string[]
  included: string[]
  not_included: string[]
  what_to_bring: string[]
  requirements: string | null
  important_info: string | null
  seo_title: string | null
  seo_description: string | null
  og_media_id: string | null
}

export interface CatalogProduct {
  id: string
  kind: string
  segment: CatalogKind
  sku: string | null
  status: 'draft' | 'published' | 'archived'
  booking_mode: 'instant' | 'on_request' | 'not_bookable'
  is_featured: boolean
  place_id: string | null
  cover_media_id: string | null
  video_media_id: string | null
  gallery_id: string | null
  gallery_media_ids: string[]
  sort_order: number
  published_at: string | null
  updated_at: string
  translations: Partial<Record<CatalogLocale, CatalogTranslation>>
  category_ids: string[]
  primary_category_id: string | null
  tag_ids: string[]
  amenity_ids: string[]
  related_ids: string[]
  tax_ids: string[]
  extras: { extra_product_id: string, is_mandatory: boolean }[]
  details: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  paths: Partial<Record<CatalogLocale, string>>
  media: Record<string, { url: string | null, kind: string, alt: Partial<Record<CatalogLocale, string>> }>
  booked: boolean
  used_in: {
    packages: { id: string, status: string, name: string }[]
    mandatory_extra_of: { id: string, segment: CatalogKind | null, status: string, name: string }[]
  }
  save_report?: { slots?: SlotSync }
}

export interface CatalogRow {
  id: string
  name: string
  status: CatalogProduct['status']
  booking_mode: CatalogProduct['booking_mode']
  sort_order: number
  updated_at: string
  sku: string | null
  is_featured: boolean
  missing_locales: CatalogLocale[]
  cover_url: string | null
  from_price_minor: number | null
  numbers: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Check { code: string, ok: boolean }
export interface Checklist { blocking: Check[], warnings: Check[] }

export interface Unit {
  id: string
  code: string
  name: string | null
  place_id: string | null
  status: 'active' | 'maintenance' | 'retired'
  latitude: string | null
  longitude: string | null
  notes: string | null
  sort_order: number
}

export interface Night {
  day: string
  capacity: number
  reserved: number
  available: number
  stop_sell: boolean
  min_nights_override: number | null
  closed_to_arrival: boolean
  closed_to_departure: boolean
  season_id: string | null
  closed: boolean
}

export interface CalendarPatch {
  from: string
  to: string
  days_of_week?: number
  stop_sell?: boolean
  min_nights_override?: number | null
  closed_to_arrival?: boolean
  closed_to_departure?: boolean
  capacity?: number
}

export interface Closure { id: string, scope: string, unit_id: string | null, from: string, to: string, reason: string | null, is_public: boolean }

export interface Schedule {
  id?: string
  days_of_week: number
  start_time: string
  capacity: number
  valid_from: string
  valid_to: string | null
  is_active: boolean
}

export interface SlotSync {
  created: number
  updated: number
  deleted: number
  kept_booked: { slot_id: string, starts_at: string, reserved: number, reason: string }[]
}

export interface CatalogSlot {
  id: string
  schedule_id: string | null
  starts_at: string
  ends_at: string
  local: string
  capacity: number
  reserved: number
  available: number
  status: 'open' | 'closed' | 'full' | 'cancelled'
  guide_user_id: string | null
  guide_name: string | null
  guide_language: string | null
  notes: string | null
}

export interface Requirement { resource_kind: string, units_per_group: number, participants_per_group: number }

export interface ItineraryStep {
  day_number: number
  place_id: string | null
  duration_minutes: number | null
  media_id: string | null
  translations: Partial<Record<CatalogLocale, { title: string, description: string | null }>>
}

export interface PackageItem {
  item_product_id: string
  quantity: number
  day_number: number | null
  is_optional: boolean
  kind?: string
  segment?: CatalogKind | null
  status?: string
  name?: string
  sample_price_minor?: number | null
}

export interface PriceRule {
  id?: string
  rate_plan_id: string | null
  season_id: string | null
  guest_category_id: string | null
  pricing_unit: string
  amount_minor: number
  extra_guest_amount_minor: number | null
  min_quantity: number
  max_quantity: number | null
  min_nights: number | null
  days_of_week: number
  valid_from: string | null
  valid_to: string | null
  priority: number
  is_active: boolean
  ambiguous_with?: string[]
}

export interface SimulatorInput {
  date?: string
  departure?: string
  slot_id?: string
  time?: string
  guests: Record<string, number>
  quantity?: number
  rate_plan_id?: string | null
  promo_code?: string | null
}

export interface Names { [locale: string]: string }

export interface References {
  seasons: { id: string, code: string, color: string | null, priority: number, names: Names }[]
  rate_plans: { id: string, code: string, is_public: boolean, is_active: boolean, names: Names, cancellation_policy_id: string | null, deposit_type: string, payment_mode: string }[]
  guest_categories: { id: string, code: string, min_age: number | null, max_age: number | null, is_active: boolean, counts_toward_capacity: boolean, names: Names }[]
  cancellation_policies: { id: string, code: string, is_default: boolean, rules: { min_hours_before: number, refund_percent: number }[], names: Names }[]
  taxes: { id: string, code: string, calc_type: string, rate_percent: string | null, amount_minor: number | null, is_inclusive: boolean, is_active: boolean, names: Names }[]
  locales: string[]
  defaults: { check_in_from: string }
}

export interface BookingRef { booking_id: string, reference: string, status: string, arrival: string | null, departure: string | null, starts_at: string | null }

export type ProductSave = Omit<Partial<CatalogProduct>, 'translations'> & {
  updated_at?: string
  translations: Partial<Record<CatalogLocale, Partial<CatalogTranslation>>>
  itinerary?: ItineraryStep[]
  items?: PackageItem[]
  prices?: PriceRule[]
  schedules?: Schedule[]
  resource_requirements?: Requirement[]
}

/** A field of a shared-settings form (MzSettingsScreen). */
export interface SettingField {
  key: string
  type: 'code' | 'text' | 'number' | 'select' | 'switch' | 'color' | 'names' | 'money' | 'percent' | 'periods' | 'rules' | 'textarea'
  label: string
  options?: { value: string | undefined, label: string }[]
  /** Shown only when this returns true for the form. */
  when?: (form: Record<string, any>) => boolean // eslint-disable-line @typescript-eslint/no-explicit-any
  help?: string
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export function catalogAdminApi(http: ReturnType<typeof $fetch.create>) {
  const base = (k: CatalogKind) => `/catalog/${k}`
  const one = (k: CatalogKind, id: string) => `/catalog/${k}/${id}`
  const settings = <T extends Json>(path: string) => ({
    list: () => http<{ data: T[] }>(`/catalog/${path}`),
    create: (body: Json) => http<{ id: string }>(`/catalog/${path}`, { method: 'POST', body }),
    update: (id: string, body: Json) => http<{ id: string }>(`/catalog/${path}/${id}`, { method: 'PUT', body }),
    remove: (id: string) => http<null>(`/catalog/${path}/${id}`, { method: 'DELETE' }),
  })
  return {
    references: () => http<References>('/catalog/references'),
    list: (k: CatalogKind, query: Record<string, string | undefined> = {}) => http<{ data: CatalogRow[] }>(base(k), { query }),
    get: (k: CatalogKind, id: string) => http<CatalogProduct>(one(k, id)),
    create: (k: CatalogKind, body: ProductSave) => http<CatalogProduct>(base(k), { method: 'POST', body }),
    save: (k: CatalogKind, id: string, body: ProductSave) => http<CatalogProduct>(one(k, id), { method: 'PATCH', body }),
    remove: (k: CatalogKind, id: string, confirm?: string) => http<null>(one(k, id), { method: 'DELETE', query: { confirm } }),
    duplicate: (k: CatalogKind, id: string) => http<{ id: string }>(`${one(k, id)}/duplicate`, { method: 'POST' }),
    setStatus: (k: CatalogKind, id: string, action: 'publish' | 'unpublish' | 'archive') => http<CatalogProduct>(`${one(k, id)}/${action}`, { method: 'POST' }),
    checklist: (k: CatalogKind, id: string) => http<Checklist>(`${one(k, id)}/publish-checklist`),
    reorder: (k: CatalogKind, ids: string[]) => http<null>(`${base(k)}/order`, { method: 'PUT', body: { ids } }),
    bulk: (k: CatalogKind, action: 'publish' | 'unpublish' | 'archive', ids: string[]) =>
      http<{ results: { id: string, ok: boolean, code?: string }[] }>(`${base(k)}/bulk`, { method: 'POST', body: { action, ids } }),
    itinerary: (k: CatalogKind, id: string) => http<{ data: (ItineraryStep & { id: string })[] }>(`${one(k, id)}/itinerary`),
    // Stays
    units: (id: string) => http<{ inventory_mode: 'unit' | 'pool', pool_capacity: number | null, data: Unit[] }>(`${one('stays', id)}/units`),
    createUnit: (id: string, body: Partial<Unit>) => http<{ id: string }>(`${one('stays', id)}/units`, { method: 'POST', body }),
    bulkUnits: (id: string, body: { prefix: string, from: number, to: number, width?: number }) => http<{ created: number }>(`${one('stays', id)}/units/bulk`, { method: 'POST', body }),
    updateUnit: (id: string, unitId: string, body: Partial<Unit>) => http<{ id: string }>(`${one('stays', id)}/units/${unitId}`, { method: 'PATCH', body }),
    deleteUnit: (id: string, unitId: string) => http<null>(`${one('stays', id)}/units/${unitId}`, { method: 'DELETE' }),
    reorderUnits: (id: string, ids: string[]) => http<null>(`${one('stays', id)}/units/order`, { method: 'PUT', body: { ids } }),
    setInventory: (id: string, body: { inventory_mode: 'unit' | 'pool', pool_capacity?: number | null }) => http<Json>(`${one('stays', id)}/inventory`, { method: 'PUT', body }),
    calendar: (id: string, from: string, to: string) => http<{ inventory_mode: string, nights: Night[], seasons: { id: string, code: string, name: string, color: string | null }[] }>(`${one('stays', id)}/calendar`, { query: { from, to } }),
    patchCalendar: (id: string, body: CalendarPatch) => http<{ nights: number }>(`${one('stays', id)}/calendar`, { method: 'PATCH', body }),
    closures: (k: CatalogKind, id: string) => http<{ data: Closure[] }>(`${one(k, id)}/closures`),
    createClosure: (k: CatalogKind, id: string, body: { from: string, to: string, reason?: string, is_public?: boolean, unit_id?: string }) =>
      http<{ id: string }>(`${one(k, id)}/closures`, { method: 'POST', body }),
    deleteClosure: (k: CatalogKind, id: string, closureId: string) => http<null>(`${one(k, id)}/closures/${closureId}`, { method: 'DELETE' }),
    // Activities
    schedules: (id: string) => http<{ data: Schedule[] }>(`${one('activities', id)}/schedules`),
    saveSchedules: (id: string, body: Schedule[]) => http<SlotSync>(`${one('activities', id)}/schedules`, { method: 'PUT', body }),
    previewSchedules: (id: string, body: Schedule[]) => http<{ data: { starts_at: string, local: string, capacity: number }[] }>(`${one('activities', id)}/schedules/preview`, { method: 'POST', body }),
    slots: (id: string, from?: string, to?: string) => http<{ data: CatalogSlot[] }>(`${one('activities', id)}/slots`, { query: { from, to } }),
    createSlot: (id: string, body: { date: string, time: string, capacity: number, guide_user_id?: string | null, guide_language?: string | null }) =>
      http<{ id: string }>(`${one('activities', id)}/slots`, { method: 'POST', body }),
    patchSlot: (slotId: string, body: Partial<Pick<CatalogSlot, 'capacity' | 'status' | 'guide_user_id' | 'guide_language' | 'notes'>>) =>
      http<{ id: string, capacity: number, status: string }>(`/catalog/slots/${slotId}`, { method: 'PATCH', body }),
    guides: () => http<{ data: { id: string, name: string, email: string }[] }>('/catalog/guides'),
    requirements: (id: string) => http<{ data: (Requirement & { available: number, max_participants: number })[], max_participants: number | null, schedules_over: { id: string, start_time: string, capacity: number }[] }>(`${one('activities', id)}/resource-requirements`),
    saveRequirements: (id: string, body: Requirement[]) => http<null>(`${one('activities', id)}/resource-requirements`, { method: 'PUT', body }),
    // Packages
    items: (id: string, date?: string) => http<{ date: string, data: PackageItem[] }>(`${one('packages', id)}/items`, { query: { date } }),
    availability: (id: string, start: string, party: string) =>
      http<{ available: boolean, total_minor: number, blocking: { product_id: string, name: string, kind: string, date: string | null, code: string, message: string }[] }>(`${one('packages', id)}/availability`, { query: { start, party } }),
    // Pricing
    prices: (k: CatalogKind, id: string) => http<{ data: PriceRule[], allowed_units: string[], tax_ids: string[] }>(`${one(k, id)}/prices`),
    savePrices: (k: CatalogKind, id: string, body: PriceRule[]) => http<{ data: PriceRule[], allowed_units: string[], tax_ids: string[] }>(`${one(k, id)}/prices`, { method: 'PUT', body }),
    saveTaxes: (k: CatalogKind, id: string, taxIds: string[]) => http<null>(`${one(k, id)}/taxes`, { method: 'PUT', body: { tax_ids: taxIds } }),
    quote: (k: CatalogKind, id: string, body: SimulatorInput) => http<{ quote: TripQuote, rules: Record<string, Json> }>(`${one(k, id)}/price-quote`, { method: 'POST', body }),
    // Shared settings (Tarifs) and resources
    seasons: settings('pricing/seasons'),
    ratePlans: settings('pricing/rate-plans'),
    guestCategories: settings('pricing/guest-categories'),
    policies: settings('pricing/cancellation-policies'),
    resources: settings('resources'),
  }
}

/** `{error: {code, details: {fields}}}` of a failed call. */
export function apiError(e: unknown): { code?: string, message?: string, details?: Json } {
  return (e as { data?: { error?: { code?: string, message?: string, details?: Json } } }).data?.error ?? {}
}
