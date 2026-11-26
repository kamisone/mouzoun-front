import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzProductView from '~/components/booking/MzProductView.vue'
import type { MediaRef, ProductPage } from '~/utils/booking-types'

/** Product pages: the video is the first gallery slide, the cover its poster; nothing without one. */
const img = (id: string): MediaRef => ({ id, url: `https://cdn.example/${id}.jpg`, width: 800, height: 600, blurhash: null, alt: `Image ${id}` })
const page = (video: MediaRef | null): ProductPage => ({
  id: 'p1', kind: 'activity', slug: 'balade-en-quad', name: 'Balade en quad', subtitle: null, short_description: 'Une heure de dunes.',
  booking_mode: 'instant', is_featured: false, cover: img('cover'), from_price_minor: 4500, from_price_unit: 'per_person', rating: null,
  facts: {}, description: null, highlights: [], included: [], not_included: [], what_to_bring: [], requirements: null, important_info: null,
  seo_title: null, seo_description: null, alternates: [], gallery: [img('g1'), img('g2'), img('g3'), img('g4'), img('g5')], video,
  amenities: [], accommodation: null, activity: null, package: null, itinerary: [], extras: [], units: [], place: null, reviews: [], faqs: [], related: [],
} as unknown as ProductPage)

describe('product gallery video', () => {
  it('puts the video first with the cover as poster, loaded only on tap', async () => {
    const video: MediaRef = { id: 'v1', url: 'https://cdn.example/quad.mp4', width: null, height: null, blurhash: null, alt: null }
    const wrapper = await mountSuspended(MzProductView, { props: { product: page(video) } })
    const gallery = wrapper.find('[data-testid="product-gallery"]')
    const first = gallery.element.firstElementChild as HTMLElement
    expect(first.dataset.testid).toBe('product-video')
    expect(wrapper.find('[data-testid="product-video"] img').attributes('src')).toContain('cover.jpg')
    expect(wrapper.find('[data-testid="product-video"] video').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('quad.mp4')
    // Video + 4 images keep the 5-tile layout.
    expect(gallery.findAll('img').length).toBe(5)
    await wrapper.find('[data-testid="video-play"]').trigger('click')
    expect(wrapper.find('[data-testid="product-video"] video').attributes('src')).toBe('https://cdn.example/quad.mp4')
  })

  it('shows no player without a video', async () => {
    const wrapper = await mountSuspended(MzProductView, { props: { product: page(null) } })
    expect(wrapper.find('[data-testid="product-video"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="video-player"]').exists()).toBe(false)
  })
})
