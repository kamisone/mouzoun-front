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

async function pickFile(file: File, props: Record<string, unknown>) {
  const updates: unknown[] = []
  const wrapper = await mountSuspended(MzMediaField, { props: { ...props, 'onUpdate:modelValue': (v: unknown) => updates.push(v) } })
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file] })
  await input.trigger('change')
  await flushPromises()
  return { wrapper, updates }
}
const sized = (name: string, type: string, bytes: number) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}

describe('MzMediaField videos', () => {
  it('a video field offers MP4 and WebM and uploads them', async () => {
    upload.mockResolvedValueOnce({ id: 'v1', kind: 'video', url: 'https://storage.googleapis.com/b/media/v1.mp4', original_filename: 'quad.mp4' })
    const { wrapper, updates } = await pickFile(sized('quad.mp4', 'video/mp4', 80 * 1024 * 1024), { kinds: ['video'], purpose: 'video' })
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('video/mp4,video/webm')
    expect(upload).toHaveBeenCalledOnce()
    expect(updates.at(-1)).toBe('v1')
  })

  it('refuses a .mov with a French message asking for an MP4 export', async () => {
    for (const file of [sized('IMG_0001.MOV', 'video/quicktime', 1000), sized('clip.mov', '', 1000)]) {
      const { wrapper } = await pickFile(file, { kinds: ['video'], purpose: 'video' })
      expect(wrapper.find('[role="alert"]').text()).toContain('Exportez la vidéo en MP4 (H.264)')
    }
    expect(upload).not.toHaveBeenCalled()
  })

  it('applies each kind its own size limit before asking the API', async () => {
    const big = await pickFile(sized('long.mp4', 'video/mp4', 101 * 1024 * 1024), { kinds: ['video'] })
    expect(big.wrapper.find('[role="alert"]').text()).toContain('100 Mo')
    const image = await pickFile(sized('dune.jpg', 'image/jpeg', 16 * 1024 * 1024), { kinds: ['image'] })
    expect(image.wrapper.find('[role="alert"]').text()).toContain('15 Mo')
    // An image field does not take a video.
    const wrong = await pickFile(sized('quad.mp4', 'video/mp4', 1000), { kinds: ['image'] })
    expect(wrong.wrapper.find('[role="alert"]').text()).toContain('JPEG, PNG, WebP ou AVIF')
    expect(upload).not.toHaveBeenCalled()
  })

  it('shows the API refusal of a .mov in French too', async () => {
    upload.mockRejectedValueOnce(Object.assign(new Error('415'), { statusCode: 415, data: { error: { code: 'video_mov' } } }))
    const { wrapper } = await pickFile(sized('export.mp4', 'video/mp4', 1000), { kinds: ['video'] })
    expect(wrapper.find('[role="alert"]').text()).toContain('MP4 (H.264)')
  })
})

describe('MzMediaField purpose', () => {
  it('titles, explains and names the upload after its purpose, with the formats and limit', async () => {
    const cover = await mountSuspended(MzMediaField, { props: { purpose: 'cover' } })
    expect(cover.find('[data-testid="media-field-title"]').text()).toBe('Image de couverture')
    expect(cover.find('[data-testid="media-field-hint"]').text()).toMatch(/cartes.*affiche de la vidéo.*1600 px.*JPEG, PNG, WebP ou AVIF, 15 Mo max\./)
    expect(cover.find('[data-testid="media-field-upload"]').text()).toBe("Choisir l'image de couverture")
    const video = await mountSuspended(MzMediaField, { props: { purpose: 'video', kinds: ['video'] } })
    expect(video.find('[data-testid="media-field-title"]').text()).toBe('Vidéo de présentation')
    expect(video.find('[data-testid="media-field-hint"]').text()).toMatch(/première diapositive.*1080p.*MP4 \(H\.264\) ou WebM, 100 Mo max\./)
    expect(video.find('[data-testid="media-field-upload"]').text()).toBe('Choisir la vidéo')
    const gallery = await mountSuspended(MzMediaField, { props: { purpose: 'gallery', multiple: true } })
    expect(gallery.find('[data-testid="media-field-title"]').text()).toBe('Galerie photos')
    expect(gallery.find('[data-testid="media-field-upload"]').text()).toBe('Ajouter des photos')
  })

  it('falls back to a generic title by kind, and keeps an explicit label', async () => {
    const plain = await mountSuspended(MzMediaField, { props: { kinds: ['video'] } })
    expect(plain.find('[data-testid="media-field-title"]').text()).toBe('Vidéo')
    expect(plain.find('[data-testid="media-field-hint"]').text()).toBe('MP4 (H.264) ou WebM, 100 Mo max.')
    const labelled = await mountSuspended(MzMediaField, { props: { label: 'Image · Rouge', purpose: 'swatch' } })
    expect(labelled.find('[data-testid="media-field-title"]').text()).toBe('Image · Rouge')
    expect(labelled.find('[data-testid="media-field-upload"]').text()).toBe("Choisir l'image de la variante")
  })
})
