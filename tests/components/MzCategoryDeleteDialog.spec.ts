import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzCategoryDeleteDialog from '~/components/admin/categories/MzCategoryDeleteDialog.vue'
import type { CategoryImpact } from '~/utils/shop-admin-api'

/** Deleting a category: the impact is shown and Delete waits for the required choices. */
const impact: CategoryImpact = {
  id: 'dates', name: 'Dattes', parent_id: null, products: 3, products_without_category: 2,
  subcategories: [{ id: 'medjool', name: 'Medjool' }], promotions: [], shipping_rules: [], variations: [],
  menu_links: [{ id: 'l1', name: 'header · Dattes' }], requires_confirmation: true, blocked: false,
}
const { api } = vi.hoisted(() => ({
  api: {
    impact: vi.fn(async (): Promise<unknown> => impact),
    remove: vi.fn(async () => null),
    list: vi.fn(async () => ({ data: [], version: 'v', max_depth: 3 })),
  },
}))
mockNuxtImport('useAdminApi', () => () => ({ shop: { categories: api } }))

async function mount() {
  const wrapper = await mountSuspended(MzCategoryDeleteDialog, { props: { categoryId: 'dates', categoryName: 'Dattes', open: true } })
  await flushPromises()
  const body = () => document.body
  const button = () => body().querySelector<HTMLButtonElement>('[data-testid="delete-category"]')!
  return { wrapper, body, button }
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('MzCategoryDeleteDialog', () => {
  it('shows the impact and blocks Delete until a target is chosen and the name typed', async () => {
    const { body, button } = await mount()
    const text = body().querySelector('[data-testid="delete-impact"]')!.textContent!
    expect(text).toContain('3')
    expect(text).toMatch(/2 sans autre catégorie|2 with no other category/)
    expect(button().disabled).toBe(true)
    // "Move" is chosen by default: a target is missing, and the name.
    expect(body().querySelector('[data-testid="delete-missing"]')!.textContent).toMatch(/produits|products/)

    // Only remove the links, then type the name: Delete becomes available.
    const unlink = body().querySelector<HTMLButtonElement>('[role="radio"][id$=":unlink"]')!
    unlink.click()
    await flushPromises()
    const input = body().querySelector<HTMLInputElement>('[data-testid="delete-confirm-name"]')!
    input.value = 'Dattes'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(button().disabled).toBe(false)
    button().click()
    await flushPromises()
    expect(api.remove).toHaveBeenCalledWith('dates', { products_to: null, subcategories_to: null, menu_links: 'replace', confirm_name: 'Dattes' })
  })

  it('refuses to delete while an active promotion targets the category', async () => {
    api.impact.mockResolvedValueOnce({ ...impact, promotions: [{ id: 'p1', name: 'DATES10', active: true }], blocked: true })
    const { body, button } = await mount()
    expect(body().textContent).toContain('DATES10')
    expect(button().disabled).toBe(true)
    expect(body().querySelector('[data-testid="delete-confirm-name"]')).toBeNull()
  })
})
