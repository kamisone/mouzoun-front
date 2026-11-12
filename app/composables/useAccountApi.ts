import type {
  Account,
  AccountUpdate,
  DeletionStatus,
  IdentifyResult,
  NotificationCategory,
  NotificationChannel,
  NotificationPrefs,
  Passkey,
  Provider,
  SavedCard,
  SavedTraveller,
  SessionView,
  SignInResult,
  Ticket,
  TripsTab,
  TripSummary,
  Wishlist,
} from '~/utils/account-types'

export type TravellerBody = Omit<SavedTraveller, 'id' | 'has_id_document' | 'id_consent_at'> & {
  id_document_number?: string | null
  id_consent: boolean
}

/**
 * Typed client of the guest account API (`/v1/account`). Browser only: the session lives in
 * HttpOnly cookies the API rotates, and a rotation during server rendering would be lost.
 */
export function useAccountApi() {
  // Not useI18n(): this client is also used from route middleware and after awaits.
  const nuxtApp = useNuxtApp()
  const locale = computed(() => (nuxtApp.$i18n as unknown as { locale: Ref<string> }).locale.value)
  const config = useRuntimeConfig()
  const base = `${config.public.apiBase}/v1/account`
  const http = $fetch.create({
    baseURL: base,
    credentials: 'include',
    onRequest({ options }) {
      if (import.meta.server) throw new Error('useAccountApi is browser-only')
      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set('Accept-Language', locale.value)
      options.headers = headers
    },
  })
  const json = <T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) =>
    http<T>(path, { method, body: body as Record<string, unknown> | undefined })

  return {
    base,
    auth: {
      identify: (email: string, returnTo?: string, captchaToken?: string | null) =>
        json<IdentifyResult>('/auth/identify', 'POST', { email, return_to: returnTo, captcha_token: captchaToken }),
      code: (email: string, code: string, sharedDevice: boolean) =>
        json<SignInResult>('/auth/code', 'POST', { email, code, shared_device: sharedDevice }),
      link: (email: string, token: string, sharedDevice: boolean) =>
        json<SignInResult>('/auth/link', 'POST', { email, token, shared_device: sharedDevice }),
      password: (email: string, password: string, sharedDevice: boolean) =>
        json<SignInResult>('/auth/password', 'POST', { email, password, shared_device: sharedDevice }),
      passkeyOptions: () => json<PublicKeyCredentialRequestOptionsJSON>('/auth/passkey/options', 'POST'),
      passkey: (credential: unknown, sharedDevice: boolean) =>
        json<SignInResult>('/auth/passkey', 'POST', { credential, shared_device: sharedDevice }),
      logout: () => json<null>('/auth/logout', 'POST'),
      logoutAll: () => json<{ revoked: number }>('/auth/logout-all', 'POST'),
      reauthSend: () => json<null>('/auth/reauth/code', 'POST'),
      reauth: (body: { code?: string, password?: string }) => json<null>('/auth/reauth', 'POST', body),
      reauthPasskeyOptions: () => json<PublicKeyCredentialRequestOptionsJSON>('/auth/reauth/passkey/options', 'POST'),
      reauthPasskey: (credential: unknown) => json<null>('/auth/reauth/passkey', 'POST', { credential }),
      providers: () => http<Record<Provider, boolean>>('/oauth/providers'),
      /** Full-page navigation to the provider. */
      oauthUrl: (provider: Provider, opts: { returnTo?: string, sharedDevice?: boolean, link?: boolean } = {}) => {
        const q = new URLSearchParams({ locale: locale.value })
        if (opts.returnTo) q.set('return_to', opts.returnTo)
        if (opts.sharedDevice) q.set('shared_device', 'true')
        if (opts.link) q.set('intent', 'link')
        return `${base}/oauth/${provider}/start?${q}`
      },
    },
    me: () => http<Account>('/me'),
    update: (body: AccountUpdate) => json<Account>('/me', 'PATCH', body),
    trips: (tab: TripsTab, page = 1) =>
      http<{ tab: TripsTab, page: number, total: number, trips: TripSummary[] }>('/trips', { query: { tab, page } }),
    ticket: (reference: string) => http<Ticket>(`/trips/${encodeURIComponent(reference)}/ticket`),
    claim: (reference: string, email: string) => json<{ sent: boolean }>('/trips/claim', 'POST', { reference, email }),
    confirmClaim: (token: string) => json<{ reference: string }>('/trips/claim/confirm', 'POST', { token }),
    notifications: () => http<{ preferences: NotificationPrefs, always_on: string[] }>('/notifications'),
    setNotification: (category: NotificationCategory, channel: NotificationChannel, enabled: boolean) =>
      json<unknown>('/notifications', 'PUT', { category, channel, enabled }),
    sessions: () => http<{ sessions: SessionView[] }>('/sessions'),
    revokeSession: (id: string) => json<null>(`/sessions/${id}`, 'DELETE'),
    setPassword: (password: string) => json<null>('/password', 'POST', { password }),
    removePassword: () => json<null>('/password', 'DELETE'),
    requestEmailChange: (email: string) => json<null>('/email', 'POST', { email }),
    confirmEmailChange: (code: string) => json<Account>('/email/confirm', 'POST', { code }),
    unlink: (provider: Provider) => json<null>(`/identities/${provider}`, 'DELETE'),
    passkeys: {
      list: () => http<{ passkeys: Passkey[] }>('/passkeys'),
      options: () => json<PublicKeyCredentialCreationOptionsJSON>('/passkeys/options', 'POST'),
      add: (credential: unknown, name?: string) => json<{ id: string, name: string }>('/passkeys', 'POST', { credential, name }),
      remove: (id: string) => json<null>(`/passkeys/${id}`, 'DELETE'),
    },
    wishlists: {
      list: () => http<{ lists: Wishlist[] }>('/wishlists'),
      create: (name: string) => json<{ id: string }>('/wishlists', 'POST', { name }),
      rename: (id: string, name: string) => json<null>(`/wishlists/${id}`, 'PATCH', { name }),
      remove: (id: string) => json<null>(`/wishlists/${id}`, 'DELETE'),
      put: (id: string, product: string, body: { note?: string | null, from?: string } = {}) =>
        json<null>(`/wishlists/${id}/items/${product}`, 'PUT', body),
      removeItem: (id: string, product: string) => json<null>(`/wishlists/${id}/items/${product}`, 'DELETE'),
      share: (id: string) => json<{ share_token: string }>(`/wishlists/${id}/share`, 'POST'),
      unshare: (id: string) => json<null>(`/wishlists/${id}/share`, 'DELETE'),
      shared: (token: string) => http<Wishlist>(`/wishlists/shared/${encodeURIComponent(token)}`),
    },
    saved: {
      ids: () => http<{ product_ids: string[] }>('/saved'),
      merge: (productIds: string[]) => json<{ product_ids: string[] }>('/saved', 'POST', { product_ids: productIds }),
      add: (product: string) => json<null>(`/saved/${product}`, 'PUT'),
      remove: (product: string) => json<null>(`/saved/${product}`, 'DELETE'),
    },
    travellers: {
      list: () => http<{ travellers: SavedTraveller[], id_numbers_enabled: boolean }>('/travellers'),
      create: (body: TravellerBody) => json<{ id: string }>('/travellers', 'POST', body),
      update: (id: string, body: TravellerBody) => json<null>(`/travellers/${id}`, 'PUT', body),
      remove: (id: string) => json<null>(`/travellers/${id}`, 'DELETE'),
      reveal: (id: string) => json<{ id_document_number: string | null }>(`/travellers/${id}/document`, 'POST'),
    },
    cards: {
      list: () => http<{ cards: SavedCard[], provider: Record<string, unknown> }>('/payment-methods'),
      setup: () => json<{ client_secret: string, provider: Record<string, unknown> }>('/payment-methods/setup', 'POST'),
      remove: (id: string) => json<null>(`/payment-methods/${encodeURIComponent(id)}`, 'DELETE'),
    },
    privacy: {
      requestExport: () => json<{ requested: boolean, days: number }>('/privacy/export', 'POST'),
      exportUrl: (token: string) => `${base}/privacy/export?token=${encodeURIComponent(token)}`,
      deletion: () => http<DeletionStatus>('/privacy/deletion'),
      requestDeletion: () => json<{ scheduled_for: string }>('/privacy/deletion', 'POST'),
      cancelDeletion: () => json<null>('/privacy/deletion', 'DELETE'),
      cancelDeletionByLink: (token: string) => json<null>('/privacy/deletion/cancel', 'POST', { token }),
    },
  }
}
