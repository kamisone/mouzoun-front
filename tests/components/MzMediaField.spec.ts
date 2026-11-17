import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzMediaField from '~/components/admin/builder/MzMediaField.vue'

/** Builder image field: the file goes to the API; an upload that fails must say why. */
const { upload } = vi.hoisted(() => ({
  upload: vi.fn(async (): Promise<unknown> => ({ id: 'm1', kind: 'image', url: 'https://storage.googleapis.com/b/media/m1.png' })),
}))
mockNuxtImport('useAdminApi', () => () => ({ media: { upload, list: vi.fn(), get: vi.fn() } }))

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
  vi.clearAllMocks()
})

describe('MzMediaField upload', () => {
  it('sends the file to the API as public and selects the new image', async () => {
    const { updates } = await pick('image/png')
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'public')
    expect(updates.at(-1)).toBe('m1')
  })

  it('shows why the API refused the file', async () => {
    upload.mockRejectedValueOnce(Object.assign(new Error('400'), {
      statusCode: 400,
      data: { error: { code: 'bad_request', details: 'the file content does not match its type' } },
    }))
    const { wrapper, updates } = await pick('image/png')
    expect(wrapper.find('[role="alert"]').text()).toContain('does not match its type')
    expect(updates).toEqual([])
  })

  it('explains a file over the size limit', async () => {
    upload.mockRejectedValueOnce(Object.assign(new Error('413'), { statusCode: 413 }))
    const { wrapper } = await pick('image/png')
    expect(wrapper.find('[role="alert"]').text()).toMatch(/too large|trop volumineux/)
  })

  it('refuses unsupported formats before asking the API', async () => {
    const { wrapper } = await pick('image/gif')
    expect(wrapper.find('[role="alert"]').text()).toContain('JPEG, PNG, WebP')
    expect(upload).not.toHaveBeenCalled()
  })
})
