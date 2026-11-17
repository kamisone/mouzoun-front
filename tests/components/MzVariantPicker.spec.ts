import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzVariantPicker from '~/components/shop/MzVariantPicker.vue'
import type { ProductOption, ShopVariant } from '~/utils/shop-types'

/** Size × Variety: the 1 kg Boufeggous does not exist, the 500 g Medjool is sold out. */
const options: ProductOption[] = [
  { code: 'size', name: 'Taille', values: [{ code: '500g', label: '500 g', swatch_url: null }, { code: '1kg', label: '1 kg', swatch_url: null }] },
  { code: 'variety', name: 'Variété', values: [{ code: 'medjool', label: 'Medjool', swatch_url: null }, { code: 'boufeggous', label: 'Boufeggous', swatch_url: null }] },
]
const v = (id: string, size: string, variety: string, availability: ShopVariant['availability'] = 'in_stock'): ShopVariant => ({
  id, sku: id, barcode: null, is_default: false, price_minor: 1000, compare_at_price_minor: null, unit_price: null, net_quantity: null,
  net_unit: null, weight_grams: 500, availability, quantity_left: null, max_quantity: 10, options: { size, variety }, media: [],
})
const variants = [v('a', '500g', 'medjool', 'out_of_stock'), v('b', '1kg', 'medjool'), v('c', '500g', 'boufeggous')]

async function mount(selected: string) {
  const updates: (string | null)[] = []
  const wrapper = await mountSuspended(MzVariantPicker, { props: { options, variants, 'modelValue': selected, 'onUpdate:modelValue': (x: string | null) => updates.push(x) } })
  const button = (label: string) => wrapper.findAll('button[role="radio"]').find(b => b.text().includes(label))!
  return { wrapper, updates, button }
}

describe('MzVariantPicker', () => {
  it('disables the values that cannot form an available variant with the current choice', async () => {
    const { button } = await mount('b') // 1 kg Medjool
    expect(button('1 kg').attributes('aria-checked')).toBe('true')
    // 500 g Medjool is sold out: with "Medjool" chosen, 500 g is unavailable.
    expect(button('500 g').attributes('aria-disabled')).toBe('true')
    // Boufeggous only exists in 500 g: not with the chosen 1 kg (still clickable, it switches size).
    expect(button('Boufeggous').attributes('aria-disabled')).toBe('true')
    expect(button('Medjool').attributes('aria-disabled')).toBe('false')
  })

  it('selects the matching variant, and a sensible one when the combination does not exist', async () => {
    const { button, updates } = await mount('c') // 500 g Boufeggous
    await button('Medjool').trigger('click')
    // 500 g Medjool is out of stock: the available Medjool (1 kg) is taken instead.
    expect(updates.at(-1)).toBe('b')
  })

  it('draws colour swatches named by their label, and a dropdown when asked', async () => {
    const swatches: ProductOption[] = [
      { ...options[0]!, display_type: 'dropdown' },
      { code: 'variety', name: 'Variété', display_type: 'swatch', values: [
        { code: 'medjool', label: 'Medjool', swatch_url: null, swatch_color: '#5a3a22' },
        { code: 'boufeggous', label: 'Boufeggous', swatch_url: null, swatch_color: '#8b5a2b' },
      ] },
    ]
    const wrapper = await mountSuspended(MzVariantPicker, { props: { options: swatches, variants, modelValue: 'b' } })
    const radios = wrapper.findAll('button[role="radio"]')
    // Only the swatch option renders radios; the size option is a select.
    expect(radios.map(r => r.attributes('aria-label'))).toEqual(['Medjool', 'Boufeggous'])
    expect(radios[0]!.find('span').attributes('style')).toContain('background-color')
    expect(radios[0]!.attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[role="combobox"]').exists()).toBe(true)
  })
})
