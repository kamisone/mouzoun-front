import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzMediaField from '~/components/admin/builder/MzMediaField.vue'

/** Builder image field: an upload that fails must say why, never stay silent. */
const { createUpload, complete } = vi.hoisted(() => ({
  createUpload: vi.fn(async () => ({
    media_id: 'm1',
    expires_at: '2026-11-17T00:00:00Z',
    upload: { url: 'https://storage.googleapis.com/b/media/m1.png', method: 'PUT', headers: { 'x-goog-acl': 'public-read' } },
  })),
  complete: vi.fn(async () => ({ id: 'm1', kind: 'image', url: 'https://storage.googleapis.com/b/media/m1.png' })),
}))
mockNuxtImport('useAdminApi', () => () => ({ media: { createUpload, complete, list: vi.fn(), get: vi.fn() } }))

async function pick(type: string) {
  const updates: unknown[] = []
  const wrapper = await mountSuspended(MzMediaField, { props: { 'label': 'Image', 'onUpdate:modelValue': (v: unknown) => updates.push(v) } })
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'photo', { type })] })
  await input.trigger('change')
  await flushPromises()
  return { wrapper, updates }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('MzMediaField upload', () => {
  it('uploads with the signed headers and selects the new image', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const { updates } = await pick('image/png')
    expect(fetch).toHaveBeenCalledWith('https://storage.googleapis.com/b/media/m1.png', expect.objectContaining({ method: 'PUT', headers: { 'x-goog-acl': 'public-read' } }))
    expect(updates.at(-1)).toBe('m1')
  })

  it('explains a request blocked by the browser (bucket CORS)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper, updates } = await pick('image/png')
    expect(wrapper.find('[role="alert"]').text()).toContain('CORS')
    expect(complete).not.toHaveBeenCalled()
    expect(updates).toEqual([])
  })

  it('refuses unsupported formats before asking the API', async () => {
    const { wrapper } = await pick('image/gif')
    expect(wrapper.find('[role="alert"]').text()).toContain('JPEG, PNG, WebP')
    expect(createUpload).not.toHaveBeenCalled()
  })
})
