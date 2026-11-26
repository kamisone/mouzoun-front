import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzCategoryForm from '~/components/admin/categories/MzCategoryForm.vue'
import MzCategoryTree from '~/components/admin/categories/MzCategoryTree.vue'
import MzCategoryProducts from '~/components/admin/categories/MzCategoryProducts.vue'
import MzCategoryDeleteDialog from '~/components/admin/categories/MzCategoryDeleteDialog.vue'
import type { AdminCategoryRow, CategoryImpact } from '~/utils/shop-admin-api'

/**
 * Stay and activity categories (Admin › Catalogue › Catégories) reuse the shop category screens
 * with `scope="product"`: their own endpoints, one flat ordered list, bookable products, and none
 * of the shop-only parts (menus, default sort, parent, search preview, stock, redirects).
 */
const row = (id: string, sort: number, name: string): AdminCategoryRow => ({
  id, parent_id: null, sort_order: sort, icon: null, cover_media_id: null, cover_url: null, is_active: true, show_in_menu: false,
  default_sort: 'manual', first_activated_at: null, updated_at: '2026-11-26T10:00:00Z',
  translations: { fr: { name, slug: id, description: null, seo_title: null, seo_description: null } },
  product_count: 0, published_count: 0, product_count_total: 0, published_count_total: 0,
})
const rows = [row('desert', 0, 'Aventure désert'), row('farm', 1, 'Vie à la ferme'), row('stays', 2, 'Hébergements')]
const impact: CategoryImpact = {
  id: 'desert', name: 'Aventure désert', parent_id: null, products: 2, products_without_category: 2,
  subcategories: [], promotions: [], shipping_rules: [], variations: [], menu_links: [], requires_confirmation: true, blocked: false,
}
const { api, shopApi, lookup } = vi.hoisted(() => {
  const make = () => ({
    list: vi.fn(async () => ({ data: [] as unknown[], version: 'v', max_depth: 1 })),
    get: vi.fn(),
    save: vi.fn(async (): Promise<unknown> => ({ id: 'new-id' })),
    products: vi.fn(async (): Promise<unknown> => ({ default_sort: 'manual', data: [] })),
    impact: vi.fn(async (): Promise<unknown> => null),
    remove: vi.fn(async () => null),
    orderProducts: vi.fn(async () => null),
    addProducts: vi.fn(async () => ({ added: 1 })),
    removeProduct: vi.fn(async () => null),
  })
  return { api: make(), shopApi: make(), lookup: vi.fn(async () => ({ options: [{ id: 'quad', label: 'Quad 1h', hint: 'activity · published' }] })) }
})
mockNuxtImport('useAdminApi', () => () => ({
  shop: { categories: shopApi, products: { list: vi.fn(async () => ({ data: [] })) } },
  catalog: { categories: api },
  lookup,
  media: { texts: vi.fn() },
}))
mockNuxtImport('useRoute', () => () => ({ params: { id: 'new' }, query: {}, path: '/admin/catalog/categories/new' }))
mockNuxtImport('useShopAdmin', () => () => ({ can: () => true, act: async (fn: () => Promise<unknown>) => fn(), statusColor: () => 'neutral' }))

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('stay and activity category form', () => {
  it('leaves out the shop-only fields and saves to the catalog endpoint', async () => {
    const wrapper = await mountSuspended(MzCategoryForm, { props: { scope: 'product' } })
    await flushPromises()
    // No menus, default sort or parent; no search preview of a shop address.
    expect(wrapper.find('#organisation').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('/boutique/')
    expect(wrapper.text()).toMatch(/pas encore de page|no page of their own/)
    await wrapper.get('[data-testid="name-fr"] input, input[data-testid="name-fr"]').setValue('Aventure désert')
    await flushPromises()
    expect((wrapper.get('[data-testid="slug-fr"] input, input[data-testid="slug-fr"]').element as HTMLInputElement).value).toBe('aventure-desert')
    await wrapper.get('[data-testid="save-category"]').trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ translations: { fr: expect.objectContaining({ name: 'Aventure désert', slug: 'aventure-desert' }) } }), undefined)
    expect(shopApi.save).not.toHaveBeenCalled()
  })
})

describe('stay and activity category list (flat)', () => {
  async function mount() {
    const wrapper = await mountSuspended(MzCategoryTree, { props: { rows, maxDepth: 1, base: '/admin/catalog/categories', menus: false } })
    const li = (id: string) => wrapper.get(`[data-testid="category-row-${id}"]`)
    return { wrapper, li }
  }

  it('reorders where the shop tree would nest, and never indents', async () => {
    const { wrapper, li } = await mount()
    // The middle of a row nests in the shop tree; here it means "after" (halves).
    await li('stays').trigger('dragstart')
    await li('desert').trigger('dragover', { clientY: 0.5 })
    await li('desert').trigger('drop', { clientY: 0.5 })
    expect(wrapper.emitted('move')![0]![0]).toEqual([
      { id: 'stays', parent_id: null, sort_order: 1 },
      { id: 'farm', parent_id: null, sort_order: 2 },
    ])
    expect(wrapper.emitted('refused')).toBeUndefined()
    // → would indent: ignored, no move and no refusal.
    await wrapper.get('[data-handle="farm"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('move')).toHaveLength(1)
    expect(wrapper.emitted('refused')).toBeUndefined()
    // ↑ still moves.
    await wrapper.get('[data-handle="farm"]').trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('move')![1]![0]).toEqual([
      { id: 'farm', parent_id: null, sort_order: 0 },
      { id: 'desert', parent_id: null, sort_order: 1 },
    ])
  })

  it('links to the catalog form and has no "hidden from menu" state', async () => {
    const { wrapper, li } = await mount()
    expect(li('farm').get('a').attributes('href')).toBe('/admin/catalog/categories/farm')
    expect(wrapper.text()).not.toMatch(/Masquée du menu|Hidden from menu/)
  })
})

describe('products of a stay and activity category', () => {
  it('shows the kind, links to the catalog editor and searches bookable products', async () => {
    api.products.mockResolvedValueOnce({
      default_sort: 'manual',
      data: [{ product_id: 'camel', kind: 'activity', name: 'Dromadaire', status: 'published', sort_order: 0, is_pinned: false, is_primary: true, stock: 0, image_url: null }],
    })
    const wrapper = await mountSuspended(MzCategoryProducts, { props: { categoryId: 'desert', defaultSort: 'manual', scope: 'product' } })
    await flushPromises()
    expect(api.products).toHaveBeenCalledWith('desert')
    expect(shopApi.products).not.toHaveBeenCalled()
    expect(wrapper.get('a[href="/admin/catalog/activities/camel"]').text()).toBe('Dromadaire')
    expect(wrapper.text()).toMatch(/Activité|Activity/)
    expect(wrapper.text()).not.toMatch(/en stock|in stock/i)
    // The search is debounced.
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledWith('product', expect.objectContaining({ kinds: ['accommodation', 'activity', 'package', 'extra'] })), { timeout: 3000 })
  })
})

describe('deleting a stay and activity category', () => {
  it('shows only what applies and deletes through the catalog endpoint', async () => {
    api.impact.mockResolvedValueOnce(impact)
    await mountSuspended(MzCategoryDeleteDialog, { props: { categoryId: 'desert', categoryName: 'Aventure désert', open: true, scope: 'product' } })
    await flushPromises()
    const text = document.body.querySelector('[data-testid="delete-impact"]')!.textContent!
    expect(text).toMatch(/produits|products/)
    expect(text).not.toMatch(/livraison|shipping|bibliothèque|library|sous-catégorie|subcategor/)
    expect(document.body.textContent).not.toMatch(/redirigeront|will redirect/)
    expect(api.impact).toHaveBeenCalledWith('desert')
    expect(shopApi.impact).not.toHaveBeenCalled()
  })
})
