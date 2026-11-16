import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MzSchemaFields from '~/components/admin/builder/MzSchemaFields.vue'
import type { FieldError, Json, SchemaNode } from '~/utils/page-types'

/** The form generator: one widget per `x-widget`, groups, languages, server errors by path. */
const defs: Record<string, SchemaNode> = {
  media_id: { 'type': 'string', 'format': 'uuid', 'x-widget': 'media', 'x-ref': 'media' },
  link: { 'type': 'object', 'x-widget': 'link', 'properties': { type: { type: 'string' }, route: { type: 'string' }, new_tab: { type: 'boolean' } } },
}
function schema(properties: Record<string, SchemaNode>, required: string[] = []): SchemaNode {
  return { type: 'object', properties, required, $defs: defs }
}

async function mount(root: SchemaNode, modelValue: Json, extra: { localized?: boolean, errors?: FieldError[], group?: string } = {}) {
  const updates: Json[] = []
  const wrapper = await mountSuspended(MzSchemaFields, {
    props: { root, modelValue, path: '/blocks/0/settings', ...extra, 'onUpdate:modelValue': (v: Json) => updates.push(v) },
  })
  await flushPromises()
  return { wrapper, updates }
}

describe('MzSchemaFields', () => {
  it('text, textarea and number', async () => {
    const { wrapper, updates } = await mount(schema({
      eyebrow: { 'type': 'string', 'x-widget': 'text', 'maxLength': 60, 'title': 'Eyebrow' },
      subtitle: { 'type': 'string', 'x-widget': 'textarea', 'title': 'Subtitle' },
      zoom: { 'type': 'integer', 'x-widget': 'number', 'minimum': 3, 'maximum': 18, 'title': 'Zoom' },
    }), { zoom: 9 })
    await wrapper.find('[data-field="eyebrow"] input').setValue('Bientôt')
    expect(updates.at(-1)).toEqual({ zoom: 9, eyebrow: 'Bientôt' })
    expect(wrapper.find('[data-field="subtitle"] textarea').exists()).toBe(true)
    const zoom = wrapper.find('[data-field="zoom"] input')
    expect(zoom.attributes('type')).toBe('number')
    expect(zoom.attributes('max')).toBe('18')
    await zoom.setValue('12')
    expect(updates.at(-1)).toEqual({ zoom: 12 })
    // emptying a text removes the key (falls back / uses the default)
    await wrapper.find('[data-field="eyebrow"] input').setValue('')
    expect(updates.at(-1)).not.toHaveProperty('eyebrow')
  })

  it('toggle, select and multi-select', async () => {
    const { wrapper } = await mount(schema({
      autoplay: { 'type': 'boolean', 'x-widget': 'toggle', 'default': true, 'title': 'Autoplay' },
      height: { 'type': 'string', 'x-widget': 'select', 'enum': ['screen', 'large'], 'title': 'Height' },
      fields: { 'type': 'array', 'x-widget': 'select', 'items': { type: 'string', enum: ['dates', 'guests'] }, 'title': 'Fields' },
    }), { height: 'large', fields: ['dates'] })
    expect(wrapper.find('[data-field="autoplay"] [role="switch"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-field="height"]').text()).toContain('Grande')
    expect(wrapper.find('[data-field="fields"]').text()).toContain('Dates')
  })

  it('colour scheme, icon, rich text and HTML', async () => {
    const { wrapper, updates } = await mount(schema({
      color_scheme: { 'type': 'string', 'x-widget': 'color_scheme', 'enum': ['light', 'dark', 'sand', 'night', 'brand'] },
      icon: { 'type': 'string', 'x-widget': 'icon' },
      body: { 'type': 'string', 'x-widget': 'richtext' },
      html: { 'type': 'string', 'x-widget': 'html' },
    }), { body: '<p>Bonjour</p>' })
    const radios = wrapper.findAll('[data-field="color_scheme"] [role="radio"]')
    expect(radios).toHaveLength(5)
    await radios[2]!.trigger('click')
    expect(updates.at(-1)).toMatchObject({ color_scheme: 'sand' })
    await wrapper.find('[data-field="icon"] input').setValue('i-lucide-coffee')
    expect(updates.at(-1)).toMatchObject({ icon: 'i-lucide-coffee' })
    const editor = wrapper.find('[data-field="body"] [contenteditable="true"]')
    expect(editor.html()).toContain('<p>Bonjour</p>')
    expect(wrapper.find('[data-field="body"] [role="toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-field="html"] .font-mono textarea, [data-field="html"] textarea.font-mono').exists()).toBe(true)
  })

  it('media, link, pickers and date-time widgets', async () => {
    const { wrapper, updates } = await mount(schema({
      media_id: { $ref: '#/$defs/media_id', title: 'Image' },
      link: { $ref: '#/$defs/link', title: 'Link' },
      place_ids: { 'type': 'array', 'items': { type: 'string' }, 'x-widget': 'place_picker', 'x-ref': 'place' },
      starts: { 'type': 'string', 'x-widget': 'datetime' },
    }), {})
    expect(wrapper.find('[data-field="media_id"]').text()).toContain('Choisir dans la médiathèque')
    expect(wrapper.find('[data-testid="picker-place"]').exists()).toBe(true)
    // camp time (Africa/Casablanca) → ISO instant, whatever the browser's own zone
    await wrapper.find('[data-field="starts"] input[type="datetime-local"]').setValue('2027-03-20T09:30')
    const starts = updates.at(-1)!.starts as string
    const camp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Casablanca', dateStyle: 'short', timeStyle: 'short' }).format(new Date(starts))
    expect(camp).toBe('2027-03-20 09:30')
    expect(wrapper.find('[data-field="link"]').text()).toContain('Aucun')
    expect(wrapper.find('[data-field="link"] [aria-label="Type de lien"]').exists()).toBe(true)
  })

  it('a source switches between a rule and hand-picked ids', async () => {
    const root = schema({
      source: {
        'type': 'object',
        'x-widget': 'source',
        'title': 'Source',
        'properties': {
          mode: { type: 'string', enum: ['manual', 'rule'] },
          ids: { 'type': 'array', 'items': { type: 'string' }, 'x-widget': 'product_picker', 'title': 'Hand-picked' },
          rule: { type: 'object', properties: { limit: { 'type': 'integer', 'x-widget': 'number', 'title': 'How many' } } },
        },
      },
    })
    const { wrapper } = await mount(root, { source: { mode: 'rule', rule: { limit: 6 } } })
    expect(wrapper.find('[data-field="limit"] input').element).toHaveProperty('value', '6')
    const manual = await mount(root, { source: { mode: 'manual', ids: [] } })
    expect(manual.wrapper.find('[data-testid="picker-product"]').exists()).toBe(true)
  })

  it('translatable fields: a tab per language, missing markers, only the edited language changes', async () => {
    const root = schema({ title: { 'type': 'string', 'x-widget': 'text', 'title': 'Title' } }, ['title'])
    const { wrapper, updates } = await mount(root, { fr: { title: 'Désert' }, en: {} }, { localized: true })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map(t => t.text())).toEqual(['fr', 'en', 'ar'])
    expect(wrapper.findAll('[title="Traduction manquante"]')).toHaveLength(2)
    await wrapper.find('[data-testid="locale-tab-title-ar"]').trigger('click')
    const input = wrapper.find('[data-field="title"] input')
    expect(input.attributes('dir')).toBe('rtl')
    await input.setValue('الصحراء')
    expect(updates.at(-1)).toEqual({ fr: { title: 'Désert' }, en: {}, ar: { title: 'الصحراء' } })
  })

  it('shows server errors under the field they point to, and filters by group', async () => {
    const root = schema({
      height: { 'type': 'string', 'x-widget': 'select', 'enum': ['screen'], 'x-group': 'layout' },
      overlay_opacity: { 'type': 'integer', 'x-widget': 'number', 'x-group': 'layout' },
      media_id: { '$ref': '#/$defs/media_id', 'x-group': 'content' },
    })
    const errors = [{ path: '/blocks/0/settings/overlay_opacity', code: 'maximum', message: '95 is greater than the maximum of 80' }]
    const { wrapper } = await mount(root, { overlay_opacity: 95 }, { errors, group: 'layout' })
    expect(wrapper.find('[data-field="media_id"]').exists()).toBe(false)
    expect(wrapper.find('[data-field="overlay_opacity"]').text()).toContain('95 is greater than the maximum of 80')
    expect(wrapper.find('[data-field="height"]').text()).not.toContain('maximum')
  })
})
