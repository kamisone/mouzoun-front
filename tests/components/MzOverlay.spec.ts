import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { UButton, UPopover } from '#components'
import MzOverlay from '~/components/base/MzOverlay.vue'

/**
 * The shared overlay (cart drawer, mobile menu): a named modal dialog; Escape closes it (an inner
 * popover first); focus is trapped, returns to the opener on close, or to the fallback when the
 * opener is gone; the body scroll lock is released.
 */
const Host = defineComponent({
  props: { kind: { type: String, default: 'drawer' } },
  setup(props) {
    const open = ref(false)
    const showTrigger = ref(true)
    const trigger = ref<HTMLElement | null>(null)
    return () => h('div', [
      showTrigger.value ? h('button', { 'data-testid': 'trigger', 'onClick': (e: MouseEvent) => { trigger.value = e.currentTarget as HTMLElement; open.value = true } }, 'Panier') : null,
      h('button', { 'data-testid': 'fallback' }, 'Fallback'),
      h('button', { 'data-testid': 'hide-trigger', 'onClick': () => { showTrigger.value = false } }, 'hide'),
      h(MzOverlay, {
        'open': open.value,
        'onUpdate:open': (v: boolean) => { open.value = v },
        'kind': props.kind as 'drawer' | 'modal',
        'title': 'Panier',
        'trigger': trigger.value,
        'fallbackFocus': '[data-testid="fallback"]',
      }, {
        body: () => [
          h('input', { 'data-testid': 'qty', 'aria-label': 'Quantité' }),
          h(UPopover, null, {
            default: () => h(UButton, { 'label': 'Options', 'data-testid': 'popover-open' }),
            content: () => h('p', { 'data-testid': 'popover-body' }, 'Choix'),
          }),
          h('button', { 'data-testid': 'last' }, 'Dernier'),
        ],
      }),
    ])
  },
})

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const escape = (on: Element | null = document.activeElement) =>
  on!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
const tab = (shift = false) =>
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }))
async function settle() {
  await flushPromises()
  await nextTick()
  await new Promise(r => setTimeout(r, 30))
  await flushPromises()
}

async function openFromTrigger(kind = 'drawer') {
  const wrapper = await mountSuspended(Host, { props: { kind }, attachTo: document.body })
  const trigger = wrapper.get('[data-testid="trigger"]').element as HTMLButtonElement
  trigger.focus()
  trigger.click()
  await settle()
  return { wrapper, trigger }
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

describe('MzOverlay', () => {
  it('is a named modal dialog with focus inside and the body locked', async () => {
    await openFromTrigger()
    const d = dialog()!
    expect(d.getAttribute('aria-modal')).toBe('true')
    const name = document.getElementById(d.getAttribute('aria-labelledby')!)
    expect(name?.textContent).toBe('Panier')
    expect(d.contains(document.activeElement)).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('closes on Escape from an input inside, returns focus to the opener and unlocks the body', async () => {
    const { trigger } = await openFromTrigger()
    const qty = document.body.querySelector<HTMLInputElement>('[data-testid="qty"]')!
    qty.focus()
    escape(qty)
    await settle()
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('closes an open popover first, the drawer on the second Escape', async () => {
    await openFromTrigger()
    document.body.querySelector<HTMLElement>('[data-testid="popover-open"]')!.click()
    await settle()
    expect(document.body.querySelector('[data-testid="popover-body"]')).not.toBeNull()
    escape()
    await settle()
    expect(document.body.querySelector('[data-testid="popover-body"]')).toBeNull()
    expect(dialog()).not.toBeNull()
    escape()
    await settle()
    expect(dialog()).toBeNull()
  })

  it('falls back when the opener is gone', async () => {
    const { wrapper } = await openFromTrigger()
    // The opener disappears while the drawer is open (e.g. replaced by "Ajouté").
    ;(wrapper.vm as unknown as { $el: HTMLElement }).$el.querySelector<HTMLButtonElement>('[data-testid="hide-trigger"]')!.click()
    await settle()
    expect(document.body.querySelector('[data-testid="trigger"]')).toBeNull()
    escape(dialog())
    await settle()
    expect(dialog()).toBeNull()
    expect((document.activeElement as HTMLElement).dataset.testid).toBe('fallback')
  })

  it('traps focus: Tab from the last element wraps to the first, Shift+Tab from the first to the last', async () => {
    await openFromTrigger('modal')
    const d = dialog()!
    const focusables = [...d.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')]
    const [first, last] = [focusables[0]!, focusables.at(-1)!]
    last.focus()
    tab()
    await settle()
    expect(document.activeElement).toBe(first)
    tab(true)
    await settle()
    expect(document.activeElement).toBe(last)
  })
})
