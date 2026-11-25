import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShopProducts from '~/components/sections/ShopProducts.vue'
import ProductCarousel from '~/components/sections/ProductCarousel.vue'
import type { RenderedSection } from '~/utils/page-types'
import type { ShopCard } from '~/utils/shop-types'

/**
 * "Produits de la boutique": the shop's card (one link, no heart), the right button per case, the
 * registry addresses; "Hébergements et activités": registry addresses, heart only when allowed.
 */
const { add } = vi.hoisted(() => ({ add: vi.fn(async () => {}) }))
mockNuxtImport('useShopCart', () => () => ({ add, error: { value: null }, open: { value: false } }))

const card = (id: string, extra: Partial<ShopCard> = {}): ShopCard => ({
  id, url: `/boutique/p/${id}`, slug: id, name: `Produit ${id}`, short_description: null, product_type: 'food',
  image_url: null, image_blurhash: null, price_min_minor: 900, price_max_minor: 900, compare_at_minor: null, currency: 'EUR',
  availability: 'in_stock', variant_count: 1, default_variant_id: `v-${id}`, rating_avg: null, rating_count: 0, is_featured: true,
  cover: null, secondary_image: null, price_minor: 900, compare_at_price_minor: null, price_is_from: false, unit_price: null,
  max_quantity: 20, badges: [], rating: null, ...extra,
})

function section(products: ShopCard[], status: string, settings: Record<string, unknown> = {}): RenderedSection {
  return {
    id: 's1', type: 'shop_products', anchor_id: null, visible_on: 'all', analytics_label: null, appearance: {},
    settings: { layout: 'grid_4', quick_add: true, show_view_all: true, ...settings }, content: { title: 'Produits de la ferme' }, items: [],
    data: { products, view_all_url: '/boutique/dattes', shop_status: status },
  }
}

async function mount(s: RenderedSection) {
  const wrapper = await mountSuspended(ShopProducts, { props: { section: s, index: 0 } })
  await flushPromises()
  return wrapper
}

afterEach(() => vi.clearAllMocks())

describe('ShopProducts', () => {
  const products = [
    card('seul'),
    card('multi', { default_variant_id: null, variant_count: 2, price_is_from: true }),
    card('epuise', { availability: 'out_of_stock', badges: ['sold_out'] }),
  ]

  it('uses the shop card: one link per card to its registry address, no wishlist heart', async () => {
    const wrapper = await mount(section(products, 'open'))
    const cards = wrapper.findAll('[data-testid="shop-card"]')
    expect(cards).toHaveLength(3)
    for (const [i, c] of cards.entries()) {
      const links = c.findAll('a').filter(a => a.attributes('data-testid') === 'shop-card-link')
      expect(links).toHaveLength(1)
      expect(links[0]!.attributes('href')).toBe(products[i]!.url)
      // The link holds the name and the photo, nothing is nested inside it.
      expect(links[0]!.find('a').exists()).toBe(false)
    }
    expect(wrapper.findComponent({ name: 'MzWishlistButton' }).exists()).toBe(false)
    expect(wrapper.find('[data-testid="shop-products-view-all"]').attributes('href')).toBe('/boutique/dattes')
  })

  it('offers the right button for each product when the shop is open', async () => {
    const wrapper = await mount(section(products, 'open'))
    const [single, multi, soldOut] = wrapper.findAll('[data-testid="shop-card"]')
    await single!.find('[data-testid="shop-card-add"]').trigger('click')
    expect(add).toHaveBeenCalledWith('v-seul', 1)
    expect(multi!.find('[data-testid="shop-card-options"]').attributes('href')).toBe('/boutique/p/multi')
    expect(multi!.text()).toMatch(/partir|from/i)
    expect(soldOut!.find('[data-testid="shop-card-notify"]').attributes('href')).toBe('/boutique/p/epuise')
    expect(soldOut!.find('[data-testid="shop-card-add"]').exists()).toBe(false)
  })

  it('shows no buying button in catalog-only mode, and none at all without quick add', async () => {
    let wrapper = await mount(section(products, 'catalog_only'))
    expect(wrapper.find('[data-testid="shop-card-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shop-card-options"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="shop-card-soon"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="shop-card-price"]').exists()).toBe(true)
    wrapper = await mount(section(products, 'open', { quick_add: false }))
    expect(wrapper.findAll('[data-testid="shop-card"] button')).toHaveLength(0)
    expect(wrapper.find('[data-testid="shop-card-options"]').exists()).toBe(false)
  })

  it('renders the carousel with arrows that turn in Arabic', async () => {
    const wrapper = await mount(section(products, 'open', { layout: 'carousel' }))
    const arrows = wrapper.findAll('button').filter(b => /Précédent|Suivant|Previous|Next/.test(b.attributes('aria-label') ?? ''))
    expect(arrows.length).toBe(2)
    for (const a of arrows) expect(a.classes()).toContain('rtl:rotate-180')
  })
})

describe('ProductCarousel', () => {
  it('links through the API address and shows the heart only for wishlist products', async () => {
    const s: RenderedSection = {
      id: 'p1', type: 'product_carousel', anchor_id: null, visible_on: 'all', analytics_label: null, appearance: {},
      settings: { layout: 'grid_3' }, content: {}, items: [],
      data: { products: [
        { id: 'a', kind: 'activity', slug: 'balade', name: 'Balade', short_description: null, is_featured: false, cover: null, from_price_minor: 1000, from_price_unit: 'person', rating: null, facts: {}, url: '/activities/balade', wishlistable: true },
        { id: 'b', kind: 'extra', slug: 'bois', name: 'Bois', short_description: null, is_featured: false, cover: null, from_price_minor: 500, from_price_unit: null, rating: null, facts: {}, url: '/x/bois', wishlistable: false },
      ] },
    }
    const wrapper = await mountSuspended(ProductCarousel, { props: { section: s, index: 0 } })
    await flushPromises()
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/activities/balade')
    expect(hrefs).toContain('/x/bois')
    expect(wrapper.findAllComponents({ name: 'MzWishlistButton' })).toHaveLength(1)
  })
})
