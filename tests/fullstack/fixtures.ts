import { type APIRequestContext, test as base, expect } from '@playwright/test'
import type { ConsentChoice } from '../../app/utils/consent'
import { withConsent } from '../consent'
import { completeFoodInformation } from './helpers'

/**
 * Fixtures of the full-stack suite. Every spec imports `test` and `expect` from here.
 *
 * - `consent` (option, default `'granted'`): the browser starts with the cookie choice already
 *   made, written exactly as the app writes it (local storage `mz-consent` + `mz-consent-at`,
 *   utils/consent.ts), so the banner never shows. `test.use({ consent: null })` for the
 *   banner's own spec.
 * - `shopMode` (option) and `shop`: a spec states the shop mode it needs
 *   (`test.use({ shopMode: 'catalog_only' })`) or changes it mid-test (`shop.mode('open')`).
 *   The mode is set through the admin API (cache invalidation and outbox run as for the admin
 *   screen), the fixture waits until the public site shows it, and everything it touched is put
 *   back after the test, even when the test fails: the mode, and what opening needs (the French
 *   legal entity, tax-rate confirmations, card payments, the mediator, the products' food
 *   information). `shop.remember()` takes the same snapshot for a spec that edits these through
 *   the UI (legal-entity.spec.ts).
 */
export type ShopMode = 'closed' | 'catalog_only' | 'open'

export const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'
export const ORIGIN = process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210'

/** Settings that opening the shop changes (the mode itself first). */
const SETTINGS = ['shop.status', 'payments.stripe.enabled', 'shop.consumer_mediator'] as const
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

interface Snapshot {
  settings: Record<string, unknown>
  entity: Json
  rates: Json[]
  products: Map<string, Json>
}

/** Body of `PUT /shop/products/{id}` from its detail (what the product editor sends). */
const productBody = (d: Json) => ({
  status: d.status, is_featured: d.is_featured, sort_order: d.sort_order, cover_media_id: d.cover_media_id, gallery_media_ids: d.gallery_media_ids,
  category_ids: d.category_ids, related_ids: d.related_ids, tax_ids: d.tax_ids, tag_ids: d.tag_ids, translations: d.translations, shop: d.shop,
})

export class ShopState {
  private saved: Snapshot | null = null
  constructor(private request: APIRequestContext, private baseURL: string) {}

  private async call(method: 'GET' | 'PUT' | 'PATCH', path: string, data?: unknown) {
    const res = await this.request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: ORIGIN } })
    expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
    return res.json()
  }

  /** Records the shop's global state once per test (restored by `restore`). */
  async remember() {
    if (this.saved) return
    const { values } = await this.call('GET', '/shop/settings')
    const entities = await this.call('GET', '/shop/legal-entities')
    const { rates } = await this.call('GET', '/shop/tax-rates')
    const list = await this.call('GET', '/shop/products?per_page=100')
    const products = new Map<string, Json>()
    for (const p of list.data as { id: string }[]) products.set(p.id, await this.call('GET', `/shop/products/${p.id}`))
    this.saved = {
      settings: Object.fromEntries(SETTINGS.map(k => [k, values[k]])),
      entity: entities.data.find((e: { code: string }) => e.code === 'mouzoun_fr'),
      rates,
      products,
    }
  }

  /** Fills what the French compliance checklist requires (test identity, confirmed rates...). */
  async makeCompliant() {
    await this.remember()
    const fr = this.saved!.entity
    await this.call('PUT', `/shop/legal-entities/${fr.id}`, {
      legal_name: 'MOUZOUN TEST SAS', legal_form: 'SAS', share_capital_minor: 100000,
      address: { line1: '1 rue de Test', postal_code: '75001', city: 'Paris', country_code: 'FR' },
      registration: { siren: '732829320', siret: '73282932000074', rcs_city: 'Paris', vat_number: 'FR44732829320' },
      email: 'boutique@example.com', host: { name: 'Google Cloud France SARL' },
    })
    for (const r of this.saved!.rates.filter(x => x.country_code === 'FR' && x.is_active && !x.is_confirmed)) {
      await this.call('PUT', `/shop/tax-rates/${r.id}`, { ...r, is_confirmed: true })
    }
    await this.call('PATCH', '/shop/settings', { 'payments.stripe.enabled': true, 'shop.consumer_mediator': { name: 'Médiateur test', url: 'https://mediateur.example' } })
    await completeFoodInformation(this.request, API, ORIGIN)
  }

  /** Sets the mode (making the shop compliant first for `open`) and waits for the public site. */
  async mode(mode: ShopMode) {
    await this.remember()
    if (mode === 'open') await this.makeCompliant()
    await this.call('PATCH', '/shop/settings', { 'shop.status': mode })
    await this.reflects(mode)
  }

  /** The public API and the server-rendered shop page both show `mode`. */
  async reflects(mode: ShopMode) {
    await expect.poll(async () => {
      const res = await this.request.fetch(`${API}/v1/shop/config`)
      return res.ok() ? (await res.json()).status : `HTTP ${res.status()}`
    }, { message: `public shop config is ${mode}` }).toBe(mode)
    await expect.poll(async () => {
      const res = await this.request.fetch(`${this.baseURL}/boutique`)
      if (mode === 'closed') return res.status() === 404
      const html = await res.text()
      return res.ok() && html.includes('data-testid="shop-coming-soon"') === (mode === 'catalog_only')
    }, { message: `/boutique renders the ${mode} shop` }).toBe(true)
  }

  /** Puts back everything `remember` recorded. The mode goes back first when it was not open. */
  async restore() {
    const s = this.saved
    if (!s) return
    this.saved = null
    const status = s.settings['shop.status'] as ShopMode
    if (status !== 'open') await this.call('PATCH', '/shop/settings', { 'shop.status': status })
    await this.call('PUT', `/shop/legal-entities/${s.entity.id}`, s.entity)
    const { rates } = await this.call('GET', '/shop/tax-rates')
    for (const r of rates as Json[]) {
      const before = s.rates.find(x => x.id === r.id)
      if (before && before.is_confirmed !== r.is_confirmed) await this.call('PUT', `/shop/tax-rates/${r.id}`, before)
    }
    for (const [id, before] of s.products) {
      const now = await this.call('GET', `/shop/products/${id}`)
      if (JSON.stringify(now.shop?.translations) !== JSON.stringify(before.shop?.translations)) await this.call('PUT', `/shop/products/${id}`, productBody(before))
    }
    const rest = Object.fromEntries(Object.entries(s.settings).filter(([k]) => k !== 'shop.status'))
    await this.call('PATCH', '/shop/settings', status === 'open' ? s.settings : rest)
    await this.reflects(status)
  }
}

interface Fixtures {
  consent: ConsentChoice | null
  shopMode: ShopMode | undefined
  shop: ShopState
  declaredShopMode: undefined
}

export const test = base.extend<Fixtures>({
  consent: ['granted', { option: true }],
  shopMode: [undefined, { option: true }],

  // The project's storage state (staff session or none) plus the consent, before any page loads.
  storageState: async ({ storageState, consent, baseURL }, use) => {
    await use(consent ? withConsent(storageState, consent, baseURL!) : storageState)
  },

  shop: async ({ request, baseURL }, use) => {
    const shop = new ShopState(request, baseURL!)
    await use(shop)
    await shop.restore()
  },

  declaredShopMode: [async ({ shopMode, shop }, use) => {
    if (shopMode) await shop.mode(shopMode)
    await use(undefined)
  }, { auto: true }],
})

export { expect }
