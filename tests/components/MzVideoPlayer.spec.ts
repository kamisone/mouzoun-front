import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzVideoPlayer from '~/components/base/MzVideoPlayer.vue'

/** The shared player: nothing loads before the tap in deferred mode, never autoplay with sound. */
const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined)
afterEach(() => play.mockClear())

const base = { title: 'Balade en quad en vidéo', playLabel: 'Lire la vidéo', poster: { url: 'https://cdn.example/cover.jpg' } }

describe('MzVideoPlayer', () => {
  it('deferred: shows the poster and loads the video only when tapped, then plays it', async () => {
    const wrapper = await mountSuspended(MzVideoPlayer, { props: { ...base, src: 'https://cdn.example/quad.mp4', deferred: true } })
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('quad.mp4')
    expect(wrapper.find('img').attributes('src')).toContain('cover.jpg')
    await wrapper.find('[data-testid="video-play"]').trigger('click')
    const video = wrapper.find('video')
    expect(video.attributes('src')).toBe('https://cdn.example/quad.mp4')
    expect(video.attributes('autoplay')).toBeUndefined()
    expect((video.element as HTMLVideoElement).muted).toBe(false)
    expect(video.attributes('controls')).toBeDefined()
    expect(play).toHaveBeenCalledOnce()
  })

  it('never autoplays a deferred video, even when asked to autoplay muted', async () => {
    const wrapper = await mountSuspended(MzVideoPlayer, { props: { ...base, src: 'https://cdn.example/quad.mp4', deferred: true, autoplayMuted: true } })
    expect(wrapper.find('video').exists()).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })

  it('page-builder file: a muted autoplay only when asked, with controls', async () => {
    const muted = await mountSuspended(MzVideoPlayer, { props: { ...base, src: 'https://cdn.example/a.mp4', autoplayMuted: true } })
    const v = muted.find('video')
    expect(v.attributes('autoplay')).toBeDefined()
    expect((v.element as HTMLVideoElement).muted).toBe(true)
    const plain = await mountSuspended(MzVideoPlayer, { props: { ...base, src: 'https://cdn.example/a.mp4' } })
    expect(plain.find('video').attributes('autoplay')).toBeUndefined()
    expect(plain.find('video').attributes('preload')).toBe('metadata')
  })

  it('YouTube / Vimeo: no iframe before the tap', async () => {
    const wrapper = await mountSuspended(MzVideoPlayer, { props: { ...base, embed: 'https://www.youtube-nocookie.com/embed/abc123?autoplay=1' } })
    expect(wrapper.find('iframe').exists()).toBe(false)
    await wrapper.find('[data-testid="video-play"]').trigger('click')
    expect(wrapper.find('iframe').attributes('src')).toContain('youtube-nocookie.com')
  })
})
