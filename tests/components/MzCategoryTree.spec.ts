import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzCategoryTree from '~/components/admin/categories/MzCategoryTree.vue'
import type { AdminCategoryRow } from '~/utils/shop-admin-api'

/** The category tree: a drag-and-drop and the keyboard give the same move; refused drops say why. */
const row = (id: string, parent: string | null, sort: number, name: string): AdminCategoryRow => ({
  id, parent_id: parent, sort_order: sort, icon: null, cover_media_id: null, cover_url: null, is_active: true, show_in_menu: true,
  default_sort: 'manual', first_activated_at: null, updated_at: '2026-11-24T10:00:00Z',
  translations: { fr: { name, slug: id, description: null, seo_title: null, seo_description: null } },
  product_count: 0, published_count: 0, product_count_total: 0, published_count_total: 0,
})
const rows = [
  row('dates', null, 0, 'Dattes'),
  row('medjool', 'dates', 0, 'Medjool'),
  row('oil', null, 1, 'Huile'),
  row('pantry', null, 2, 'Épicerie'),
  row('ras', 'pantry', 0, 'Ras el hanout'),
  row('blends', 'ras', 0, 'Mélanges'),
]

async function mount() {
  const wrapper = await mountSuspended(MzCategoryTree, { props: { rows, maxDepth: 3 } })
  const li = (id: string) => wrapper.get(`[data-testid="category-row-${id}"]`)
  // happy-dom rows have no height: clientY 0.5 is the middle ("inside"), 0 the top ("before").
  async function drag(from: string, to: string, clientY: number) {
    await li(from).trigger('dragstart')
    await li(to).trigger('dragover', { clientY })
    await li(to).trigger('drop', { clientY })
  }
  return { wrapper, li, drag }
}

describe('MzCategoryTree', () => {
  it('nests by drag-and-drop and by keyboard with the same payload', async () => {
    const { wrapper, drag } = await mount()
    await drag('oil', 'dates', 0.5)
    const byDrop = wrapper.emitted('move')![0]![0]
    const second = await mount()
    await second.wrapper.get('[data-handle="oil"]').trigger('keydown', { key: 'ArrowRight' })
    const byKey = second.wrapper.emitted('move')![0]![0]
    expect(byDrop).toEqual(byKey)
    expect(byDrop).toEqual([
      { id: 'oil', parent_id: 'dates', sort_order: 1 },
      { id: 'pantry', parent_id: null, sort_order: 1 },
    ])
    // The move is announced for screen readers.
    expect(second.wrapper.get('[data-testid="tree-announcement"]').text()).toContain('Huile')
  })

  it('reorders when dropped between rows', async () => {
    const { wrapper, drag } = await mount()
    await drag('pantry', 'dates', 0)
    expect(wrapper.emitted('move')![0]![0]).toEqual([
      { id: 'pantry', parent_id: null, sort_order: 0 },
      { id: 'dates', parent_id: null, sort_order: 1 },
      { id: 'oil', parent_id: null, sort_order: 2 },
    ])
  })

  it('refuses a drop that would make the tree too deep or a cycle, and says so', async () => {
    const { wrapper, drag } = await mount()
    await drag('pantry', 'dates', 0.5)
    expect(wrapper.emitted('move')).toBeUndefined()
    expect(wrapper.emitted('refused')![0]).toEqual(['too_deep'])
    expect(wrapper.get('[data-testid="tree-announcement"]').text()).toMatch(/profondeur|deeper|العمق/)
    await drag('pantry', 'blends', 0.5)
    expect(wrapper.emitted('refused')![1]).toEqual(['cycle'])
  })

  it('shows no handles and allows no moves when read-only', async () => {
    const wrapper = await mountSuspended(MzCategoryTree, { props: { rows, maxDepth: 3, readOnly: true } })
    expect(wrapper.find('[data-handle]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="category-row-oil"]').attributes('draggable')).toBe('false')
  })
})
