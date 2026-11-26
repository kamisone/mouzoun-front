import type { Cart, ShopConfig } from '~/utils/shop-types'

/** Shop configuration (status, payment methods, prefixes), shared by every shop page. */
export function useShopConfig() {
  const api = useShopApi()
  return useAsyncData('shop-config', () => api.config(), { dedupe: 'defer', getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as ShopConfig | undefined })
}

/**
 * Localized path of a shop page by route name: `''` the shop home, `cart`, `checkout`,
 * `p/<slug>`, `orders/<number>`, otherwise a category slug. The URL segment per language
 * (`/boutique`, `/en/shop`) is the pages' i18n `paths`, mirrored by the `shop.route_prefix` setting.
 */
export function useShopPath() {
  const localePath = useLocalePath()
  return (path = '') => {
    const p = path.replace(/^\//, '')
    if (!p) return localePath({ name: 'shop' })
    if (p === 'cart' || p === 'checkout') return localePath({ name: `shop-${p}` })
    if (p.startsWith('p/')) return localePath({ name: 'shop-p-slug', params: { slug: p.slice(2) } })
    if (p.startsWith('orders/')) {
      const [number, query] = p.slice(7).split('?')
      const base = localePath({ name: 'shop-orders-number', params: { number } })
      return query ? `${base}?${query}` : base
    }
    return localePath({ name: 'shop-category', params: { category: p } })
  }
}

/**
 * The visitor's cart: one shared state (header badge, drawer, cart page, checkout). Every change
 * is optimistic for the quantity, then replaced by the server's re-priced cart.
 */
export function useShopCart() {
  const api = useShopApi()
  const cart = useState<Cart | null>('shop-cart', () => null)
  const open = useState('shop-cart-open', () => false)
  /** What opened the drawer (focus returns there on close): set on the client only. */
  const trigger = useState<HTMLElement | null>('shop-cart-trigger', () => null)
  function openFrom(el: Element | null | undefined) {
    trigger.value = el instanceof HTMLElement ? markRaw(el) : null
    open.value = true
  }
  const busy = useState('shop-cart-busy', () => false)
  const error = useState<string | null>('shop-cart-error', () => null)
  const { t } = useI18n()

  async function run(op: () => Promise<Cart>) {
    busy.value = true
    error.value = null
    try {
      cart.value = await op()
    }
    catch (e) {
      error.value = apiErrorMessage(e, t)
      // The server is the truth: reload after a refused change.
      cart.value = await api.cart.get().catch(() => cart.value)
      throw e
    }
    finally {
      busy.value = false
    }
  }

  return {
    cart,
    open,
    trigger,
    openFrom,
    busy,
    error,
    count: computed(() => cart.value?.item_count ?? 0),
    load: () => run(() => api.cart.get()).catch(() => {}),
    add: async (variantId: string, quantity = 1) => {
      // The button that was pressed: it is disabled (loading) while the request runs, so by the
      // time the drawer opens focus has left it.
      const from = import.meta.client ? document.activeElement : null
      await run(() => api.cart.add(variantId, quantity))
      openFrom(from)
    },
    setQuantity: (id: string, quantity: number) => {
      const line = cart.value?.items.find(i => i.id === id)
      if (line) line.quantity = quantity
      return run(() => (quantity > 0 ? api.cart.update(id, quantity) : api.cart.remove(id)))
    },
    remove: (id: string) => {
      if (cart.value) cart.value.items = cart.value.items.filter(i => i.id !== id)
      return run(() => api.cart.remove(id))
    },
    addCode: (code: string) => run(() => api.cart.addCode(code)),
    removeCode: (code: string) => run(() => api.cart.removeCode(code)),
    fulfillment: (body: Parameters<typeof api.cart.fulfillment>[0]) => run(() => api.cart.fulfillment(body)),
  }
}

/** A user-facing message for an API error (stable code → translation, else a generic one). */
export function apiErrorMessage(e: unknown, t: (key: string, values?: Record<string, unknown>) => string): string {
  const data = (e as { data?: { error?: { code?: string, message?: string } } })?.data?.error
  const code = data?.code
  if (code) {
    const key = `shop.errors.${code}`
    const message = t(key)
    if (message !== key) return message
  }
  return t('shop.errors.generic')
}
