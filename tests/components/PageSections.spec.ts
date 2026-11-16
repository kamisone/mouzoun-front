import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PageSections from '~/components/page/PageSections.vue'
import type { RenderedSection } from '~/utils/page-types'

function section(type: string, content: Record<string, unknown> = {}, extra: Partial<RenderedSection> = {}): RenderedSection {
  return { id: `id-${type}`, type, anchor_id: null, visible_on: 'all', analytics_label: null, appearance: {}, settings: {}, content, items: [], data: {}, ...extra }
}

async function render(sections: RenderedSection[], variables: Record<string, string | null> = {}) {
  const wrapper = await mountSuspended(PageSections, { props: { sections, variables } })
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('PageSections', () => {
  it('renders known types and ignores unknown ones (with a warning in development)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = await render([
      section('rich_text', { title: 'Le camp', body: '<p>Bienvenue</p>' }),
      section('teleporter', { title: 'Nope' }),
      section('spacer'),
    ])
    const frames = wrapper.findAll('section[data-section-type]')
    expect(frames.map(f => f.attributes('data-section-type'))).toEqual(['rich_text', 'spacer'])
    expect(wrapper.find('h2').text()).toBe('Le camp')
    expect(wrapper.html()).toContain('<p>Bienvenue</p>')
    expect(wrapper.text()).not.toContain('Nope')
    if (import.meta.dev) expect(warn).toHaveBeenCalledWith(expect.stringContaining('teleporter'))
    warn.mockRestore()
  })

  it('puts the anchor, device and colour-scheme classes on the section (CSS only)', async () => {
    const wrapper = await render([
      section('rich_text', { title: 'Ferme' }, { anchor_id: 'farm', visible_on: 'mobile', appearance: { color_scheme: 'sand', padding_top: 'none' } }),
      section('rich_text', { title: 'Desktop' }, { id: 'b', visible_on: 'desktop' }),
    ])
    const [mobile, desktop] = wrapper.findAll('section[data-section-type]')
    expect(mobile!.attributes('id')).toBe('farm')
    expect(mobile!.classes()).toEqual(expect.arrayContaining(['md:hidden', 'bg-muted', 'pt-0']))
    expect(desktop!.classes()).toEqual(expect.arrayContaining(['hidden', 'md:block']))
  })

  it('fills {opening_date} in the page language and renders one h1 for the hero', async () => {
    const wrapper = await render([
      section('hero', { eyebrow: 'Ouverture le {opening_date}', title: 'Le désert' }, { settings: { height: 'medium' } }),
      section('rich_text', { title: 'Suite' }),
    ], { opening_date: '2027-03-20' })
    expect(wrapper.find('.eyebrow').text()).toBe('Ouverture le 20 mars 2027')
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.find('h1').text()).toBe('Le désert')
  })

  it('hides buttons whose target is not published', async () => {
    const wrapper = await render([
      section('cta_band', { title: 'Venez', cta_primary_label: 'Réserver', cta_secondary_label: 'Voir' }, {
        settings: {
          cta_primary: { link: { type: 'route', route: '/stays', href: '/stays' }, style: 'primary' },
          cta_secondary: { link: { type: 'page', id: 'x', href: null }, style: 'secondary' },
        },
      }),
    ])
    expect(wrapper.find('[data-testid="cta-primary"]').attributes('href')).toBe('/stays')
    expect(wrapper.find('[data-testid="cta-secondary"]').exists()).toBe(false)
  })
})
