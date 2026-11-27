import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import MzRichTextField from '~/components/admin/builder/MzRichTextField.vue'

/**
 * Switching the section form's tab removes the editor while it has the focus: the browser then
 * fires `blur`, after Vue has cleared the element's ref. That late blur must not overwrite the
 * text with nothing (it used to empty the language being edited, and the draft saved it empty).
 */
const value = ref<string | undefined>('<p>Délai de rétractation</p>')
const shown = ref(true)
const Host = defineComponent({
  setup: () => () => (shown.value
    ? h(MzRichTextField, { 'label': 'Texte', 'modelValue': value.value, 'onUpdate:modelValue': (v: string | undefined) => { value.value = v } })
    : h('p', 'Mise en page')),
})

// Browsers blur a focused element while it is being removed, during Vue's unmount (after the
// template ref is cleared). happy-dom does not: emulate it on removeChild.
const removeChild = Node.prototype.removeChild
beforeEach(() => {
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    const active = document.activeElement
    if (active && active !== document.body && child.contains(active)) active.dispatchEvent(new FocusEvent('blur'))
    return removeChild.call(this, child) as T
  }
})

afterEach(() => {
  Node.prototype.removeChild = removeChild
  document.body.innerHTML = ''
  value.value = '<p>Délai de rétractation</p>'
  shown.value = true
})

describe('MzRichTextField removed while focused', () => {
  it('keeps the text typed just before, and a late blur writes nothing', async () => {
    await mountSuspended(Host, { attachTo: document.body })
    await flushPromises()
    const el = document.body.querySelector<HTMLElement>('[contenteditable="true"]')!
    expect(el.innerHTML).toBe('<p>Délai de rétractation</p>')
    // Typing: synced on input.
    el.focus()
    el.innerHTML = '<p>Délai de rétractation TEST</p>'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    expect(value.value).toBe('<p>Délai de rétractation TEST</p>')
    // The tab changes: the editor goes away, blurred on the way out.
    shown.value = false
    await flushPromises()
    expect(value.value).toBe('<p>Délai de rétractation TEST</p>')
  })

  it('still saves on blur while it is on screen', async () => {
    await mountSuspended(Host, { attachTo: document.body })
    await flushPromises()
    const el = document.body.querySelector<HTMLElement>('[contenteditable="true"]')!
    el.focus()
    // A change the input event did not report (an editing command, for instance).
    el.innerHTML = '<p>Nouveau texte</p>'
    el.dispatchEvent(new FocusEvent('blur'))
    await flushPromises()
    expect(value.value).toBe('<p>Nouveau texte</p>')
  })
})
