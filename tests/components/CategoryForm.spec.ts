import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CategoryForm from '~/pages/admin/shop/categories/[id].vue'

/** The category form: slugs follow the name (accents, spaces, duplicates), unsaved changes are guarded. */
const { api } = vi.hoisted(() => ({
  api: {
    list: vi.fn(async () => ({
      data: [{ id: 'other', parent_id: null, sort_order: 0, is_active: true, show_in_menu: true, translations: { fr: { name: 'Miel', slug: 'miel' } } }],
      version: 'v',
      max_depth: 3,
    })),
    get: vi.fn(),
    save: vi.fn(async (): Promise<unknown> => ({ id: 'new-id' })),
    products: vi.fn(async () => ({ default_sort: 'manual', data: [] })),
  },
}))
mockNuxtImport('useAdminApi', () => () => ({ shop: { categories: api, products: { list: vi.fn(async () => ({ data: [] })) } }, media: { texts: vi.fn() } }))
mockNuxtImport('useRoute', () => () => ({ params: { id: 'new' }, query: {}, path: '/admin/shop/categories/new' }))
mockNuxtImport('useShopAdmin', () => () => ({ can: () => true, act: async (fn: () => Promise<unknown>) => fn(), statusColor: () => 'neutral' }))

async function mount() {
  const wrapper = await mountSuspended(CategoryForm)
  const name = wrapper.get('[data-testid="name-fr"] input, input[data-testid="name-fr"]')
  const slug = () => (wrapper.get('[data-testid="slug-fr"] input, input[data-testid="slug-fr"]').element as HTMLInputElement)
  return { wrapper, name, slug }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('category form', () => {
  it('derives the slug from the name until it is edited by hand', async () => {
    const { wrapper, name, slug } = await mount()
    await name.setValue('  Épices  du Désert ')
    await flushPromises()
    expect(slug().value).toBe('epices-du-desert')
    // Already used by another category: -2.
    await name.setValue('Miel')
    await flushPromises()
    expect(slug().value).toBe('miel-2')
    // Edited by hand: the name no longer changes it.
    const input = wrapper.get('[data-testid="slug-fr"] input, input[data-testid="slug-fr"]')
    await input.setValue('mon-miel')
    await name.setValue('Miel de jujubier')
    await flushPromises()
    expect(slug().value).toBe('mon-miel')
    // Saved with the French name and slug.
    await wrapper.get('[data-testid="save-category"]').trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ translations: { fr: expect.objectContaining({ name: 'Miel de jujubier', slug: 'mon-miel' }) } }), undefined)
  })

  it('shows the save bar and holds the tab open while changes are unsaved', async () => {
    const { wrapper, name } = await mount()
    const leave = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(leave()).toBe(false)
    await name.setValue('Coffrets')
    await flushPromises()
    expect(wrapper.get('[data-testid="save-bar"]').text()).toMatch(/non enregistrées|Unsaved/)
    expect(leave()).toBe(true)
  })
})
