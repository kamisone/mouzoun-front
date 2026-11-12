import type { Media, MediaKind, MediaVisibility, Paginated, UploadTicket, User } from '~/utils/types'
import type { PaymentOption, RegisterGuest, TripItem, TripQuote } from '~/utils/booking-types'
import type { AccountsReport, AdminBookingRow, GoLiveChecklist, AdminBookingView, AdminTask, CrmCustomer, CrmCustomerRow, ScannedTicket, TodayDashboard } from '~/utils/admin-types'

/**
 * Typed client of the back-office API (`/v1/admin/...`): every admin endpoint is declared here,
 * nowhere else. Authentication is the HttpOnly session cookie (sent with `credentials: 'include'`);
 * an expired session sends the user back to the login page.
 */
export function useAdminApi() {
  const user = useState<User | null>('auth-user', () => null)

  const http = $fetch.create({
    baseURL: `${useRuntimeConfig().public.apiBase}/v1/admin`,
    credentials: 'include',
    async onResponseError({ response }) {
      if (response.status === 401) {
        user.value = null
        await navigateTo('/admin/login')
      }
    },
  })

  return {
    dashboard: () => http<TodayDashboard>('/dashboard/today'),
    quote: (body: { items: TripItem[], rate_plan_id?: string | null, promo_code?: string | null, locale?: string }) =>
      http<{ quote: TripQuote }>('/quote', { method: 'POST', body }),
    customers: (q: string) => http<{ id: string, first_name: string, last_name: string | null, email: string | null, phone: string | null, country_code: string | null, bookings: number }[]>('/customers', { query: { q } }),
    goLive: {
      checklist: () => http<GoLiveChecklist>('/booking/go-live'),
      setEnabled: (enabled: boolean) => http<GoLiveChecklist>('/booking/enabled', { method: 'PUT', body: { enabled } }),
    },
    crm: {
      list: (query: { q?: string, account?: string, page?: number }) =>
        http<{ customers: CrmCustomerRow[], total: number, page: number, per_page: number }>('/crm/customers', { query }),
      get: (id: string) => http<CrmCustomer>(`/crm/customers/${id}`),
      signInLink: (id: string) => http(`/crm/customers/${id}/sign-in-link`, { method: 'POST' }),
      suspend: (id: string) => http(`/crm/customers/${id}/suspend`, { method: 'POST' }),
      reactivate: (id: string) => http(`/crm/customers/${id}/reactivate`, { method: 'POST' }),
      signOutAll: (id: string) => http<{ revoked: number }>(`/crm/customers/${id}/sign-out-all`, { method: 'POST' }),
      merge: (id: string, into: string) => http<{ into: string, bookings: string[] }>(`/crm/customers/${id}/merge`, { method: 'POST', body: { into } }),
      viewAs: (id: string) => http<{ read_only: true, account: Record<string, unknown>, trips: { reference: string, status: string, arrival_date: string | null, departure_date: string | null }[] }>(`/crm/customers/${id}/view-as`),
      export: (id: string) => http<Record<string, unknown>>(`/crm/customers/${id}/export`),
      deletion: (id: string) => http<{ scheduled_for: string }>(`/crm/customers/${id}/deletion`, { method: 'POST' }),
      attachBooking: (bookingId: string, customerId: string) => http(`/crm/bookings/${bookingId}/attach`, { method: 'POST', body: { customer_id: customerId } }),
      report: () => http<AccountsReport>('/crm/reports/accounts'),
    },
    scanTicket: (token: string) => http<ScannedTicket>('/tickets/scan', { method: 'POST', body: { token } }),
    tasks: {
      list: (status = 'open') => http<AdminTask[]>('/tasks', { query: { status } }),
      update: (id: string, status: 'open' | 'done' | 'dismissed') => http(`/tasks/${id}`, { method: 'PATCH', body: { status } }),
    },
    bookings: {
      list: (query: Record<string, string | number | boolean | undefined>) => http<Paginated<AdminBookingRow>>('/bookings', { query }),
      exportUrl: (query: Record<string, string | number | boolean | undefined>) => {
        const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
        return `${useRuntimeConfig().public.apiBase}/v1/admin/bookings/export.csv?${params}`
      },
      get: (id: string) => http<AdminBookingView>(`/bookings/${id}`),
      create: (body: {
        items: TripItem[]
        rate_plan_id?: string | null
        promo_code?: string | null
        customer_id?: string | null
        customer?: { first_name: string, last_name?: string, email?: string, phone?: string, country_code?: string } | null
        source: string
        payment_option: PaymentOption
        locale?: string
        special_requests?: string | null
        skip_guest_emails?: boolean
        price_override?: { total: string, reason: string } | null
        payment?: { provider: string, amount: string, note?: string } | null
        internal_note?: string | null
      }) => http<{ id: string, reference: string, status: string, total_minor: number }>('/bookings', { method: 'POST', body }),
      update: (id: string, body: { estimated_arrival_time?: string | null, special_requests?: string | null, internal_notes?: string | null }) =>
        http<AdminBookingView>(`/bookings/${id}`, { method: 'PATCH', body }),
      accept: (id: string) => http<{ status: string }>(`/bookings/${id}/accept`, { method: 'POST' }),
      decline: (id: string, reason?: string) => http(`/bookings/${id}/decline`, { method: 'POST', body: { reason } }),
      setStatus: (id: string, status: 'checked_in' | 'completed' | 'no_show' | 'confirmed', note?: string) =>
        http(`/bookings/${id}/status`, { method: 'POST', body: { status, note } }),
      cancel: (id: string, body: { reason?: string, refund: 'policy' | 'custom' | 'none', amount?: string }) =>
        http<{ refund_minor: number }>(`/bookings/${id}/cancel`, { method: 'POST', body }),
      cancelItems: (id: string, body: { item_ids: string[], refund: 'policy' | 'custom' | 'none', amount?: string }) =>
        http<{ refund_minor: number }>(`/bookings/${id}/items/cancel`, { method: 'POST', body }),
      note: (id: string, body: string) => http(`/bookings/${id}/notes`, { method: 'POST', body: { body } }),
      recordPayment: (id: string, body: { provider: string, purpose: string, amount: string, note?: string }) =>
        http(`/bookings/${id}/payments`, { method: 'POST', body }),
      refund: (id: string, body: { payment_id: string, amount: string, reason?: string }) => http(`/bookings/${id}/refunds`, { method: 'POST', body }),
      resend: (id: string, email: 'confirmation' | 'payment_link' | 'balance' | 'precheckin' | 'received') =>
        http(`/bookings/${id}/resend`, { method: 'POST', body: { email } }),
      guests: (id: string) => http<{ guests: RegisterGuest[], revealed: boolean }>(`/bookings/${id}/guests`),
    },
    media: {
      list: (query: { kind?: MediaKind; page?: number; per_page?: number } = {}) =>
        http<Paginated<Media>>('/media', { query }),
      get: (id: string) => http<Media>(`/media/${id}`),
      remove: (id: string) => http<null>(`/media/${id}`, { method: 'DELETE' }),
      createUpload: (body: { filename: string; content_type: string; size_bytes: number; visibility: MediaVisibility }) =>
        http<UploadTicket>('/media/uploads', { method: 'POST', body }),
      complete: (id: string) => http<Media>(`/media/${id}/complete`, { method: 'POST' }),
    },
  }
}
