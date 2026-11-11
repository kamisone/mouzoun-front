import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzTranslatableInput from '~/components/forms/MzTranslatableInput.vue'

type Values = Record<string, string>

async function mount(modelValue: Values) {
  const updates: Values[] = []
  const wrapper = await mountSuspended(MzTranslatableInput, {
    props: { modelValue, label: 'Nom', 'onUpdate:modelValue': (v: Values) => updates.push(v) },
  })
  return { wrapper, updates }
}

describe('MzTranslatableInput', () => {
  it('has one field per language, the Arabic one right-to-left', async () => {
    const { wrapper } = await mount({ fr: 'Tente', en: 'Tent', ar: 'خيمة' })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(3)
    const ar = inputs.find(i => i.attributes('lang')?.startsWith('ar'))!
    expect(ar.attributes('dir')).toBe('rtl')
    expect((ar.element as HTMLInputElement).value).toBe('خيمة')
    expect(inputs.filter(i => i.attributes('dir') === 'ltr')).toHaveLength(2)
    expect(ar.attributes('aria-label')).toBe('Nom (العربية)')
  })

  it('updates only the edited language and keeps the others', async () => {
    const { wrapper, updates } = await mount({ fr: 'Tente', en: '' })
    const en = wrapper.findAll('input').find(i => i.attributes('lang')?.startsWith('en'))!
    await en.setValue('Tent')
    expect(updates.at(-1)).toEqual({ fr: 'Tente', en: 'Tent' })
  })

  it('marks missing translations, required ones as such', async () => {
    const { wrapper } = await mount({ fr: '', en: 'Tent', ar: '' })
    const missing = wrapper.findAll('[title="Traduction manquante"]')
    expect(missing).toHaveLength(2)
    expect(missing[0]!.classes()).toContain('bg-error') // fr is required
    expect(missing[1]!.classes()).toContain('bg-warning')
    const fr = wrapper.findAll('input').find(i => i.attributes('lang')?.startsWith('fr'))!
    expect(fr.attributes('required')).toBeDefined()
  })
})
