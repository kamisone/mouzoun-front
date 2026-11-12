import type { ProductCard } from '~/utils/booking-types'

export type Provider = 'google' | 'apple'

export interface Account {
  id: string
  email: string
  email_verified: boolean
  first_name: string
  last_name: string | null
  phone: string | null
  country_code: string | null
  preferred_locale: string | null
  date_of_birth: string | null
  display_currency: string | null
  marketing_consent: boolean
  has_password: boolean
  identities: { id: string, provider: Provider, email: string | null, created_at: string, last_used_at: string | null }[]
  created_at: string
  next_trip: { reference: string, arrival: string, departure: string | null, status: string, days: number } | null
}

export type AccountUpdate = Partial<Pick<Account, 'first_name' | 'last_name' | 'phone' | 'country_code' | 'preferred_locale' | 'display_currency' | 'date_of_birth' | 'marketing_consent'>>

export interface SignInResult {
  account: Account
  created: boolean
  needs_profile: boolean
}

export interface IdentifyResult {
  sent: boolean
  masked_email: string
  code_minutes: number
  resend_after_seconds: number
}

export type TripsTab = 'upcoming' | 'past' | 'cancelled'

export interface TripSummary {
  reference: string
  status: string
  arrival: string | null
  departure: string | null
  days_until: number | null
  products: string | null
  product_id: string | null
  cover_url: string | null
  total_minor: number
  paid_minor: number
  balance_minor: number
  balance_due_on: string | null
  precheckin_completed: boolean
  currency: string
  party: { adults: number, children: number, infants: number }
}

export interface SessionView {
  id: string
  user_agent: string | null
  ip_address: string | null
  created_at: string
  last_used_at: string | null
  persistent: boolean
  current: boolean
}

export type NotificationCategory = 'reminders' | 'offers' | 'reviews'
export type NotificationChannel = 'email' | 'sms' | 'whatsapp'
export type NotificationPrefs = Record<NotificationCategory, Record<NotificationChannel, boolean>>

export interface Wishlist {
  id: string | null
  name: string
  is_default: boolean
  share_token: string | null
  items: { product: ProductCard, note: string | null, added_at: string }[]
}

export interface SavedTraveller {
  id: string
  first_name: string
  last_name: string
  guest_category_id: string | null
  date_of_birth: string | null
  nationality: string | null
  id_document_type: string | null
  has_id_document: boolean
  id_consent_at: string | null
}

export interface SavedCard {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  in_use: boolean
}

export interface Passkey {
  id: string
  name: string
  synced: boolean
  created_at: string
  last_used_at: string | null
}

export interface Ticket {
  token: string
  expires_at: string
  reference: string
  status: string
  arrival_date: string | null
  departure_date: string | null
  guests: { adults: number, children: number, infants: number }
  lead: string
  items: { name: string | null, kind: string, starts_at: string | null, quantity: number }[]
}

export interface DeletionStatus {
  scheduled_for: string | null
  blockers: ('upcoming_stay' | 'unpaid_balance')[]
  grace_days: number
}
