import type { BookingConfig, CartView, GuestCategory, GuestCount, TripItem } from '~/utils/booking-types'

/** Booking settings (open or not, payment providers...), fetched once per visit. */
export function useBookingConfig() {
  const api = useBookingApi()
  return useAsyncData<BookingConfig | null>('booking-config', () => api.config().catch(() => null), {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
}

/** Active guest categories (adult, child 4–11, infant 0–3...), in the page language. */
export function useGuestCategories() {
  const api = useBookingApi()
  const { locale } = useI18n()
  return useAsyncData<GuestCategory[]>(`guest-categories-${locale.value}`, () => api.guestCategories().catch(() => []), {
    default: () => [],
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
}

/** Party size by category code, as kept in the URL (`adults=2&children=1&child_ages=7`). */
export interface Party { adults: number, children: number, infants: number, childAges: number[] }

export interface SearchParams { checkin: string | null, checkout: string | null, party: Party }

const LAST_SEARCH = 'mz-last-search'

/**
 * The search lives in the URL query (shareable links, back button) and the last one is kept in
 * localStorage to prefill the next visit.
 */
export function useSearchParams() {
  const route = useRoute()
  const router = useRouter()
  const num = (v: unknown, d: number) => {
    const n = Number(Array.isArray(v) ? v[0] : v)
    return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 30) : d
  }
  const str = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

  const params = computed<SearchParams>(() => ({
    checkin: str(route.query.checkin),
    checkout: str(route.query.checkout),
    party: {
      adults: num(route.query.adults, 2) || 1,
      children: num(route.query.children, 0),
      infants: num(route.query.infants, 0),
      childAges: String(route.query.child_ages ?? '')
        .split(',')
        .map(Number)
        .filter(n => Number.isInteger(n) && n >= 0 && n < 18),
    },
  }))

  function toQuery(p: SearchParams) {
    return {
      ...(p.checkin ? { checkin: p.checkin } : {}),
      ...(p.checkout ? { checkout: p.checkout } : {}),
      adults: String(p.party.adults),
      ...(p.party.children ? { children: String(p.party.children) } : {}),
      ...(p.party.infants ? { infants: String(p.party.infants) } : {}),
      ...(p.party.childAges.length ? { child_ages: p.party.childAges.join(',') } : {}),
    }
  }

  function remember(p: SearchParams) {
    try {
      localStorage.setItem(LAST_SEARCH, JSON.stringify(p))
    }
    catch { /* private mode: nothing to remember */ }
  }

  function last(): SearchParams | null {
    try {
      const raw = localStorage.getItem(LAST_SEARCH)
      return raw ? (JSON.parse(raw) as SearchParams) : null
    }
    catch {
      return null
    }
  }

  async function update(p: SearchParams, path?: string) {
    remember(p)
    await router.push({ path: path ?? route.path, query: { ...route.query, ...toQuery(p) } })
  }

  return { params, update, remember, last, toQuery }
}

/** `[{guest_category_id, count}]` for the API from a party of adults / children / infants. */
export function partyToGuests(party: Party, categories: GuestCategory[]): GuestCount[] {
  const id = (code: string) => categories.find(c => c.code === code)?.id
  return ([['adult', party.adults], ['child', party.children], ['infant', party.infants]] as const)
    .map(([code, count]) => ({ guest_category_id: id(code) ?? '', count }))
    .filter(g => g.guest_category_id && g.count > 0)
}

/** The basket ("Your trip"), shared by the header badge and the funnel pages. */
export function useTrip() {
  const api = useBookingApi()
  const cart = useState<CartView | null>('trip-cart', () => null)
  const pending = useState('trip-pending', () => false)

  async function refresh() {
    pending.value = true
    try {
      cart.value = await api.cart.get()
    }
    catch {
      cart.value ??= { items: [], count: 0, quote: null, quote_token: null, notices: [] }
    }
    finally {
      pending.value = false
    }
    return cart.value
  }

  async function add(item: TripItem & { parent_id?: string | null }) {
    cart.value = await api.cart.add(item)
    return cart.value
  }

  async function remove(id: string) {
    cart.value = await api.cart.remove(id)
    return cart.value
  }

  async function update(id: string, item: TripItem & { parent_id?: string | null }) {
    cart.value = await api.cart.update(id, item)
    return cart.value
  }

  async function setOptions(body: { promo_code?: string, rate_plan_id?: string | null, child_ages?: number[] }) {
    cart.value = await api.cart.options(body)
    return cart.value
  }

  async function clear() {
    cart.value = await api.cart.clear()
  }

  const count = computed(() => cart.value?.count ?? 0)
  const total = computed(() => cart.value?.quote?.total_minor ?? 0)
  return { cart, pending, count, total, refresh, add, remove, update, setOptions, clear }
}

const ACCESS = 'mz-booking-access'

/**
 * Access tokens of the bookings made or opened on this device (the signed token of the
 * confirmation email). Kept so the confirmation and manage pages survive a reload.
 */
export function useBookingAccess() {
  function all(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(ACCESS) ?? '{}') as Record<string, string>
    }
    catch {
      return {}
    }
  }
  function remember(reference: string, token: string) {
    try {
      localStorage.setItem(ACCESS, JSON.stringify({ ...all(), [reference]: token }))
    }
    catch { /* not persisted: the email link still works */ }
  }
  function get(reference: string): string | null {
    return all()[reference] ?? null
  }
  return { remember, get, all }
}

/**
 * Analytics events (GA4 `dataLayer` names), sent only after cookie consent (`mz-consent` =
 * `granted`). `purchase` is sent once per booking reference.
 */
export function useAnalytics() {
  function consented() {
    try {
      return localStorage.getItem('mz-consent') === 'granted'
    }
    catch {
      return false
    }
  }
  function track(event: string, params: Record<string, unknown> = {}) {
    if (import.meta.server || !consented()) return
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer ??= []
    w.dataLayer.push({ event, ...params })
  }
  function purchaseOnce(reference: string, valueCents: number, currency = 'EUR') {
    if (import.meta.server) return
    const key = `mz-purchase-${reference}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    }
    catch { /* without storage the event may repeat on reload: acceptable */ }
    track('purchase', { transaction_id: reference, value: valueCents / 100, currency })
  }
  return { track, purchaseOnce }
}

/**
 * Product page data by slug. A missing product is a 404; anything else (API down, timeout) is a
 * 503, so search engines retry later instead of dropping the page.
 */
export async function useProductPage(slug: MaybeRefOrGetter<string>) {
  const api = useBookingApi()
  const { t } = useI18n()
  const setI18nParams = useSetI18nParams()
  const key = computed(() => `product-${toValue(slug)}`)
  const { data: product, error } = await useAsyncData(key.value, () => api.product(toValue(slug)), { watch: [() => toValue(slug)] })
  if (error.value || !product.value) {
    const status = (error.value as { statusCode?: number } | null)?.statusCode
    throw status === 404 || !error.value
      ? createError({ statusCode: 404, statusMessage: t('error.notFound'), fatal: true })
      : createError({ statusCode: 503, statusMessage: t('error.unavailable'), fatal: true })
  }
  setI18nParams(Object.fromEntries(product.value.alternates.map(a => [a.locale, { slug: a.slug }])))
  useSeo({
    title: () => product.value?.seo_title ?? `${product.value?.name} · ${t('common.siteName')}`,
    description: () => product.value?.seo_description ?? product.value?.short_description ?? '',
    image: () => product.value?.cover?.url,
  })
  return product
}
