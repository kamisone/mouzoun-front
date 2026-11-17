import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzShopIssue from '~/components/shop/MzShopIssue.vue'
import MzCartLines from '~/components/shop/MzCartLines.vue'
import type { Cart } from '~/utils/shop-types'

const plain = (s: string) => s.replace(/[\u00A0\u202F\u200F]/g, ' ').replace(/\s+/g, ' ').trim()

describe('cart issues', () => {
  it('explains each issue in words', async () => {
    const limited = await mountSuspended(MzShopIssue, { props: { issue: { code: 'quantity_limited', data: { max: 2 } } } })
    expect(plain(limited.text())).toBe('Seulement 2 disponible(s).')
    const min = await mountSuspended(MzShopIssue, { props: { issue: { code: 'below_min_order', data: { min_minor: 1500 } } } })
    expect(plain(min.text())).toContain('15,00 €')
    const promo = await mountSuspended(MzShopIssue, { props: { issue: { code: 'promotion_not_applicable', data: { code: 'BIENVENUE10', reason: 'not_eligible' } } } })
    expect(plain(promo.text())).toContain('BIENVENUE10')
    expect(plain(promo.text())).toContain('non valable pour cette commande')
    expect(promo.find('p').classes()).toContain('text-warning')
    expect(limited.find('p').classes()).toContain('text-error')
  })

  it('shows the issues of a cart on their own line', async () => {
    const cart = {
      id: 'c', currency: 'EUR', item_count: 2, promotion_codes: [], promotions: [], shipping_lines: [], issues: [], can_checkout: false, payment_methods: [],
      totals: { subtotal_minor: 2400, discount_minor: 0, shipping_minor: 0, shipping_discount_minor: 0, tax_minor: 0, cod_fee_minor: 0, total_minor: 2400, taxes_included: true },
      items: [
        { id: 'l1', variant_id: 'v1', product_id: 'p1', name: 'Dattes', slug: 'dattes', options_label: '500 g', sku: 'DATES-500', image_url: null, quantity: 1, unit_price_minor: 1200, compare_at_price_minor: null, subtotal_minor: 1200, discount_minor: 0, total_minor: 1200, issues: [] },
        { id: 'l2', variant_id: 'v2', product_id: 'p2', name: 'Huile', slug: 'huile', options_label: '1 L', sku: 'OIL-1L', image_url: null, quantity: 1, unit_price_minor: 1200, compare_at_price_minor: null, subtotal_minor: 1200, discount_minor: 0, total_minor: 1200, issues: [{ code: 'out_of_stock', line_id: 'l2' }] },
      ],
    } satisfies Cart
    const wrapper = await mountSuspended(MzCartLines, { props: { cart } })
    expect(wrapper.find('[data-testid="cart-line-DATES-500"] [data-testid="shop-issue"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cart-line-OIL-1L"] [data-testid="shop-issue"]').text()).toContain('Épuisé')
  })
})
