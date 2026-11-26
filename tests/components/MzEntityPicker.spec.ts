import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzEntityPicker from '~/components/admin/builder/MzEntityPicker.vue'

/** As a list filter: a first "any" option, shown while nothing is picked, removes the filter. */
const { lookup } = vi.hoisted(() => ({
  lookup: vi.fn(async () => ({ options: [{ id: 'desert', label: 'Aventure désert', hint: 'product' }] })),
}))
mockNuxtImport('useAdminApi', () => () => ({ lookup }))

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

const options = () => [...document.body.querySelectorAll('[role="option"]')].map(o => o.textContent!.trim())

describe('MzEntityPicker as a filter', () => {
  it('shows "any" while nothing is picked, as the first option', async () => {
    const wrapper = await mountSuspended(MzEntityPicker, { props: { kind: 'category', label: 'Catégories', anyLabel: 'Toutes les catégories', modelValue: undefined }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.get('[data-testid="picker-category"]').text()).toContain('Toutes les catégories')
    await wrapper.get('[data-testid="picker-category"]').trigger('click')
    await flushPromises()
    expect(options()[0]).toBe('Toutes les catégories')
    expect(options()).toContain('Aventure désertproduct')
  })

  it('picking "any" removes the filter', async () => {
    const wrapper = await mountSuspended(MzEntityPicker, { props: { kind: 'category', label: 'Catégories', anyLabel: 'Toutes les catégories', modelValue: 'desert' }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.get('[data-testid="picker-category"]').text()).toContain('Aventure désert')
    await wrapper.get('[data-testid="picker-category"]').trigger('click')
    await flushPromises()
    const any = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(o => o.textContent!.trim() === 'Toutes les catégories')!
    any.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBeUndefined()
  })

  it('has no "any" option unless asked (builder and editor fields)', async () => {
    const wrapper = await mountSuspended(MzEntityPicker, { props: { kind: 'category', label: 'Catégories', modelValue: undefined }, attachTo: document.body })
    await flushPromises()
    await wrapper.get('[data-testid="picker-category"]').trigger('click')
    await flushPromises()
    expect(options()).toEqual(['Aventure désertproduct'])
  })
})
