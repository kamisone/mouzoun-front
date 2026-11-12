import type { BookingStatus, BookingView } from '~/utils/booking-types'

export interface AdminBookingRow {
  id: string
  reference: string
  status: BookingStatus
  source: string
  arrival: string | null
  departure: string | null
  party: { adults: number, children: number, infants: number }
  total_minor: number
  paid_minor: number
  balance_minor: number
  balance_due_on: string | null
  hold_expires_at: string | null
  created_at: string
  customer: { first_name: string, last_name: string | null, email: string | null, phone: string | null }
  precheckin_completed: boolean
  products: string | null
  [key: string]: unknown
}

export interface TimelineEntry {
  kind: 'status' | 'email' | 'audit'
  at: string
  by?: string | null
  from?: string | null
  to?: string
  note?: string | null
  template?: string | null
  subject?: string | null
  status?: string
  action?: string
  changes?: Record<string, unknown>
  error?: string | null
}

export interface AdminTask {
  id: string
  kind: string
  status: string
  title: string
  details: Record<string, unknown>
  due_at: string | null
  created_at: string
  booking_id: string | null
  reference: string | null
}

export interface AdminBookingView extends BookingView {
  id: string
  source: string
  internal_notes: string | null
  terms: { version: string | null, accepted_at: string | null }
  checked_in_at: string | null
  checked_out_at: string | null
  skip_guest_emails: boolean
  timeline: TimelineEntry[]
  notes: { id: string, body: string, at: string, by: string | null }[]
  tasks: AdminTask[]
  refunds: { id: string, payment_id: string, amount_minor: number, status: string, reason: string | null, at: string }[]
  permissions: { write: boolean, cancel: boolean, refund: boolean, record_offline: boolean, identity: boolean }
}

interface DayBooking {
  id: string
  reference: string
  status: BookingStatus
  first_name: string | null
  last_name: string | null
  adults: number
  children: number
  total_minor: number
  paid_minor: number
  products: string | null
}

export interface TodayDashboard {
  date: string
  arrivals: DayBooking[]
  departures: DayBooking[]
  in_house: DayBooking[]
  slots: { id: string, starts_at: string, name: string, capacity: number, reserved: number, fill_rate: number, status: string, language: string | null, guide: string | null }[]
  requests: { id: string, reference: string, answer_by: string | null, arrival: string | null, total_minor: number, first_name: string, last_name: string | null }[]
  balances_due: { id: string, reference: string, due_on: string | null, due_minor: number, collection: string | null, first_name: string, last_name: string | null }[]
  failed_payments: { id: string, booking_id: string, reference: string, amount_minor: number, reason: string | null, at: string }[]
  precheckin_missing: { id: string, reference: string, arrival: string | null, first_name: string, last_name: string | null }[]
  alerts: { open_tasks: number, webhook_errors: number, dead_events: number }
}
