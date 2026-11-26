import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide, ref } from 'vue'
import MzSchemaField from '~/components/admin/builder/MzSchemaField.vue'
import type { SchemaNode } from '~/utils/page-types'

/** Page builder: a media field names its purpose per section type; the video section uploads videos. */
mockNuxtImport('useAdminApi', () => () => ({ media: { upload: vi.fn(), list: vi.fn(async () => ({ data: [], total: 0 })), get: vi.fn() }, lookup: vi.fn() }))

const field = (type: string, key: string, kinds: string[]) => defineComponent({
  setup() {
    provide('builder-section-type', ref(type))
    const node: SchemaNode = { type: 'string', 'x-widget': 'media', 'x-media-kinds': kinds } as SchemaNode
    return () => h(MzSchemaField, { root: node, node, path: `/blocks/0/settings/${key}`, label: 'Image' })
  },
})

describe('builder media purposes', () => {
  it('the video section asks for a video file, MP4 or WebM', async () => {
    const wrapper = await mountSuspended(field('video', 'media_id', ['video']))
    expect(wrapper.find('[data-testid="media-field-title"]').text()).toBe('Fichier vidéo')
    expect(wrapper.find('[data-testid="media-field-hint"]').text()).toContain('MP4 (H.264) ou WebM, 100 Mo max.')
    expect(wrapper.find('[data-testid="media-field-upload"]').text()).toBe('Choisir la vidéo')
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('video/mp4,video/webm')
  })

  it('the hero takes an image or a video; an unknown field keeps the schema label', async () => {
    const hero = await mountSuspended(field('hero', 'media_id', ['image', 'video']))
    expect(hero.find('[data-testid="media-field-title"]').text()).toBe('Image ou vidéo de fond')
    expect(hero.find('input[type="file"]').attributes('accept')).toContain('video/webm')
    const other = await mountSuspended(field('stats', 'media_id', ['image']))
    expect(other.find('[data-testid="media-field-title"]').text()).toBe('Image')
  })
})
