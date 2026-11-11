import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzPrice from '~/components/base/MzPrice.vue'

const plain = (s: string) => s.replace(/[  ‏]/g, ' ').replace(/\s+/g, ' ').trim()

describe('MzPrice', () => {
  it('formats cents in the current locale', async () => {
    const wrapper = await mountSuspended(MzPrice, { props: { cents: 125050 } })
    expect(plain(wrapper.text())).toBe('1 250,50 €')
  })

  it('adds "from" and the unit, and can drop whole cents', async () => {
    const wrapper = await mountSuspended(MzPrice, { props: { cents: 4500, from: true, unit: 'person', trimZeroCents: true } })
    expect(plain(wrapper.text())).toBe('À partir de 45 € par personne')
  })

  it('shows "Free" for 0 unless asked to show the amount', async () => {
    expect(plain((await mountSuspended(MzPrice, { props: { cents: 0 } })).text())).toBe('Gratuit')
    expect(plain((await mountSuspended(MzPrice, { props: { cents: 0, showZero: true } })).text())).toBe('0,00 €')
  })

  it('follows the language', async () => {
    const { $i18n } = useNuxtApp()
    await $i18n.loadLocaleMessages('en')
    $i18n.locale.value = 'en'
    try {
      const wrapper = await mountSuspended(MzPrice, { props: { cents: 99, unit: 'night' } })
      expect(plain(wrapper.text())).toBe('€0.99 per night')
    }
    finally {
      $i18n.locale.value = 'fr'
    }
  })
})
