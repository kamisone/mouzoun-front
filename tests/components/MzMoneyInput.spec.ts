import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MzMoneyInput from '~/components/forms/MzMoneyInput.vue'

/** Mounts with a working v-model: updates are recorded and fed back as the prop. */
async function mount(modelValue: number | null) {
  const updates: Array<number | null> = []
  const wrapper = await mountSuspended(MzMoneyInput, {
    props: {
      modelValue,
      'onUpdate:modelValue': async (v: number | null) => {
        updates.push(v)
        await wrapper.setProps({ modelValue: v })
      },
    },
  })
  return { wrapper, input: wrapper.find('input'), updates }
}

describe('MzMoneyInput', () => {
  it('shows the cents model as euros', async () => {
    const { input } = await mount(12050)
    expect((input.element as HTMLInputElement).value).toBe('120,50')
  })

  it('emits integer cents from what is typed (comma or dot)', async () => {
    const { input, updates } = await mount(null)
    await input.setValue('120,5')
    await input.setValue('1 250.75')
    await input.setValue('0,99')
    expect(updates).toEqual([12050, 125075, 99])
  })

  it('keeps the model and flags the field on invalid input', async () => {
    const { wrapper, input, updates } = await mount(500)
    await input.setValue('12,3x')
    expect(updates).toEqual([])
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('invalid')?.[0]).toEqual(['12,3x'])
  })

  it('clears to null and normalises on blur', async () => {
    const { input, updates } = await mount(500)
    await input.setValue('')
    expect(updates.at(-1)).toBeNull()
    await input.setValue('7,5')
    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('7,50')
  })

  it('has an accessible name and keeps digits left-to-right', async () => {
    const { input } = await mount(100)
    expect(input.attributes('aria-label')).toBe('Montant en euros')
    expect(input.attributes('dir')).toBe('ltr')
    expect(input.attributes('inputmode')).toBe('decimal')
  })
})
