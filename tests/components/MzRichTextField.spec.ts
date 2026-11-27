import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import MzRichTextField from '~/components/admin/builder/MzRichTextField.vue'

/**
 * "Insert company field": legal pages only; the list comes from the API (tokens the renderer
 * knows), grouped; choosing one inserts `{{token}}` into the text.
 */
const { legalTokens } = vi.hoisted(() => ({
  legalTokens: vi.fn(async () => ({ tokens: ['seller.legal_name', 'seller.siren', 'mediator.name', 'cookies.table', 'shop.withdrawal_days'] })),
}))
mockNuxtImport('useAdminApi', () => () => ({ pages: { legalTokens } }))

async function mount(pageType: string, value = '<p>SIREN : </p>') {
  const updates: (string | undefined)[] = []
  const wrapper = await mountSuspended(MzRichTextField, {
    props: { 'label': 'Corps', 'modelValue': value, 'onUpdate:modelValue': (v: string | undefined) => updates.push(v) },
    global: { provide: { 'builder-page-type': computed(() => pageType) } },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, updates }
}

describe('MzRichTextField token picker', () => {
  it('offers the company fields on a legal page and inserts a valid token', async () => {
    const { wrapper, updates } = await mount('legal')
    expect(wrapper.find('[data-testid="insert-token"]').exists()).toBe(true)
    const menu = wrapper.findComponent({ name: 'UDropdownMenu' })
    const groups = menu.props('items') as { description: string, onSelect: () => void }[][]
    const offered = groups.flat().map(i => i.description)
    // Company fields only (generated blocks such as the cookie table are not offered).
    expect(offered).toEqual(['{{seller.legal_name}}', '{{seller.siren}}', '{{mediator.name}}', '{{shop.withdrawal_days}}'])
    groups.flat().find(i => i.description === '{{seller.siren}}')!.onSelect()
    await flushPromises()
    expect(updates.at(-1)).toContain('{{seller.siren}}')
    wrapper.unmount()
  })

  it('shows no picker outside legal pages', async () => {
    legalTokens.mockClear()
    const { wrapper } = await mount('page')
    expect(wrapper.find('[data-testid="insert-token"]').exists()).toBe(false)
    expect(legalTokens).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

/**
 * Line breaks: the API keeps `<p>` and `<br>` but drops `<div>` (keeping its text), so lines the
 * browser makes as `<div>` (or text typed straight into an emptied box) are saved as paragraphs.
 */
describe('MzRichTextField line breaks', () => {
  async function typed(html: string) {
    const { wrapper, updates } = await mount('page', '')
    const editor = wrapper.find('[contenteditable="true"]')
    ;(editor.element as HTMLElement).innerHTML = html
    await editor.trigger('input')
    wrapper.unmount()
    return updates.at(-1)
  }

  it.each([
    ['div lines', '<p>Un</p><div>Deux</div><div><br></div><div>Trois</div>', '<p>Un</p><p>Deux</p><p><br></p><p>Trois</p>'],
    ['text typed into an emptied box', 'Un<div>Deux</div>', '<p>Un</p><p>Deux</p>'],
    ['inline marks at the root', 'Un <b>gras</b><br>suite', '<p>Un <b>gras</b><br>suite</p>'],
    ['a div around a list', '<div><ul><li>a</li></ul></div>', '<ul><li>a</li></ul>'],
    ['paragraphs and line breaks kept', '<p>Un<br>deux</p><p><br></p><p>Trois</p>', '<p>Un<br>deux</p><p><br></p><p>Trois</p>'],
  ])('%s', async (_, html, saved) => {
    expect(await typed(html)).toBe(saved)
  })

  it('a box with only empty lines is empty', async () => {
    expect(await typed('<p><br></p><div><br></div>')).toBeUndefined()
  })
})
