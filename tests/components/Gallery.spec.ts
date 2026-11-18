import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Gallery from '~/components/sections/Gallery.vue'
import type { GalleryPage, MediaView, RenderedSection } from '~/utils/page-types'

const { page } = vi.hoisted(() => ({ page: vi.fn() }))
mockNuxtImport('useGalleryApi', () => () => ({ page }))

const photo = (n: number): MediaView => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  kind: 'image',
  mime_type: 'image/webp',
  url: `/images/photos/p${n}.webp`,
  width: 1600,
  height: 1067,
  srcset: [{ url: `/images/photos/p${n}-800.webp`, width: 800 }],
  blurhash: null,
  placeholder: null,
  position: null,
  alt: `Photo ${n}`,
})

const ALBUMS = [
  { id: 'a1', title: 'Le camp', description: null, count: 20, cover_media_id: null, hidden_in_preview: false },
  { id: 'a2', title: 'Tentes', description: 'Sous la toile', count: 18, cover_media_id: null, hidden_in_preview: false },
  { id: 'a3', title: 'Ciel', description: null, count: 12, cover_media_id: null, hidden_in_preview: false },
]
const LIMIT: Record<string, number> = { mosaic: 5, mosaic_3: 3, cover: 1, filmstrip: 12 }

/** A section as the API renders it: `count` photos in the gallery, the preview capped by the layout. */
function section(layout: string, count: number, settings: Record<string, unknown> = {}): RenderedSection {
  const shown = Array.from({ length: Math.min(count, LIMIT[layout]!) }, (_, i) => photo(i + 1))
  return {
    id: '01938000-0000-7000-8000-00000000ga11',
    type: 'gallery',
    anchor_id: 'photos',
    visible_on: 'all',
    analytics_label: 'home_gallery',
    appearance: {},
    settings: { preview_layout: layout, preview_height: 'md', show_count: true, show_album_chips: true, viewer_layout: 'albums', ...settings },
    content: { title: 'En images' },
    items: [],
    data: {
      total_count: count,
      preview: shown.map((m, i) => ({ media_id: m.id, album_id: ALBUMS[i % 3]!.id })),
      albums: count ? ALBUMS : [],
      media: Object.fromEntries(shown.map(m => [m.id, m])),
    },
  }
}

async function render(s: RenderedSection) {
  const wrapper = await mountSuspended(Gallery, { props: { section: s, index: 1 }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  history.replaceState(null, '', location.pathname)
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('Gallery section (preview)', () => {
  for (const layout of ['mosaic', 'mosaic_3', 'cover', 'filmstrip']) {
    it(`keeps the ${layout} preview at a fixed height with 0, 3, 5 and 50 photos`, async () => {
      for (const count of [0, 3, 5, 50]) {
        const wrapper = await render(section(layout, count))
        const preview = wrapper.get('[data-testid="gallery-preview"]')
        expect(preview.classes(), `${layout} × ${count}`).toContain('md:h-110')
        const tiles = preview.findAll('button[aria-label^="Agrandir"], button[aria-label^="Enlarge"]')
        expect(tiles.length).toBeLessThanOrEqual(LIMIT[layout]!)
        expect(tiles.length).toBe(Math.min(count, LIMIT[layout]!))
        if (count) expect(wrapper.text()).toContain(String(count))
        wrapper.unmount()
      }
    })
  }

  it('follows the chosen height', async () => {
    const wrapper = await render(section('mosaic', 50, { preview_height: 'lg' }))
    expect(wrapper.get('[data-testid="gallery-preview"]').classes()).toContain('md:h-140')
  })

  it('shows one 4:3 photo at a time on phones, with "1 / N" and the button below', async () => {
    const wrapper = await render(section('mosaic', 50))
    const mobile = wrapper.get('[data-testid="gallery-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')
    expect(mobile.find('.aspect-4\\/3').exists()).toBe(true)
    // each slide takes the whole width: one photo visible at a time
    const slides = mobile.findAll('.snap-center')
    expect(slides).toHaveLength(5)
    for (const slide of slides) expect(slide.classes()).toContain('w-full')
    expect(mobile.get('[data-testid="gallery-counter"]').text()).toBe('1 / 50')
    expect(mobile.get('[data-testid="gallery-view-all"]').text()).toContain('50')
  })

  it('opens the viewer on the album of the chip, in the URL', async () => {
    page.mockImplementation(async (_id: string, query: { album?: string }) => ({
      albums: ALBUMS.map(a => ({ ...a, cover: null })),
      items: [photo(40), photo(41)].map(media => ({ media, caption: null, album_id: String(query.album) })),
      next_cursor: null,
      total_count: 50,
    } satisfies GalleryPage))
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
    const wrapper = await render(section('mosaic', 50))
    await wrapper.get('[data-testid="gallery-chip-2"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[data-testid="gallery-viewer"]')).not.toBeNull())
    expect(location.hash).toBe('#gallery-photos/album-2')
    await vi.waitFor(() => expect(page).toHaveBeenCalled())
    expect(page.mock.calls[0]![0]).toBe(section('mosaic', 1).id)
    expect(page.mock.calls[0]![1].album).toBe('a2')
    const tab = document.querySelector('[data-testid="gallery-tab-2"]')!
    expect(tab.getAttribute('aria-current')).toBe('true')
    expect(document.querySelector('[data-testid="gallery-viewer"]')!.getAttribute('aria-modal')).toBe('true')
  })
})
