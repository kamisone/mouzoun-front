<script setup lang="ts">
/**
 * The site's modal overlay: a drawer (`kind="drawer"`, Nuxt UI Slideover) or a dialog
 * (`kind="modal"`, Nuxt UI Modal), both Reka dialogs underneath. One place for the behaviour
 * every overlay needs:
 *
 * - announced as a modal dialog: `role="dialog"`, `aria-modal="true"`, named by its title;
 * - Escape closes it from anywhere inside (Reka's dismissable layers: a popover or listbox
 *   open inside is a layer above, so the first Escape closes only that one); the close button
 *   and a click on the backdrop close it too; focus moves in on open (Reka: the first focusable
 *   element) and is trapped; the rest of the page is hidden (`aria-hidden`, no pointer events)
 *   and the body scroll is locked until it closes;
 * - on close, focus goes back to the element that opened it. The opener is recorded when the
 *   overlay opens: `trigger` when the caller knows it (an "add to cart" button that is disabled
 *   while the request runs has lost focus by then), else the focused element at that moment.
 *   If it is gone, hidden or disabled by then, focus goes to `fallbackFocus` (a selector);
 * - a drawer's `side` is logical: `end` is the right in French and English, the left in Arabic.
 *
 * Other props (`fullscreen`, `ui`, `description`...) and slots pass through to Nuxt UI.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  kind?: 'drawer' | 'modal'
  title?: string
  side?: 'start' | 'end' | 'top' | 'bottom'
  /** The element that opened it, when the caller knows it better than `document.activeElement`. */
  trigger?: HTMLElement | null
  /** Where focus goes on close when the opener is gone or hidden (a CSS selector). */
  fallbackFocus?: string
  /** Extra props or listeners of the Reka dialog content. */
  content?: Record<string, unknown>
}>(), { kind: 'modal', title: undefined, side: 'end', trigger: null, fallbackFocus: undefined, content: undefined })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ 'after:leave': [] }>()
const { localeProperties } = useI18n()

const physicalSide = computed(() => {
  if (props.side === 'top' || props.side === 'bottom') return props.side
  const rtl = localeProperties.value.dir === 'rtl'
  return (props.side === 'end') !== rtl ? 'right' : 'left'
})

/**
 * Recorded when `open` turns true: the focused element is read at once (before the dialog moves
 * focus inside), `trigger` once the parent's props update is complete (`open` and `trigger`
 * arrive in the same update, in no guaranteed order).
 */
let opener: HTMLElement | null = null
watch(open, (now, before) => {
  if (!now || before || import.meta.server) return
  const active = document.activeElement as HTMLElement | null
  opener = active && active !== document.body ? active : null
  queueMicrotask(() => { if (props.trigger) opener = props.trigger })
}, { flush: 'sync', immediate: true })

function usable(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert]')
    && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true'
}
function onCloseAutoFocus(e: Event) {
  const target = usable(opener) ? opener : (props.fallbackFocus ? document.querySelector<HTMLElement>(props.fallbackFocus) : null)
  opener = null
  if (!usable(target)) return
  e.preventDefault()
  target.focus()
}
const contentProps = computed(() => ({ 'aria-modal': 'true', ...props.content, onCloseAutoFocus }))
</script>

<template>
  <USlideover
    v-if="props.kind === 'drawer'"
    v-bind="$attrs"
    v-model:open="open"
    :title="props.title"
    :side="physicalSide"
    :content="contentProps"
    @after:leave="emit('after:leave')"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </USlideover>
  <UModal
    v-else
    v-bind="$attrs"
    v-model:open="open"
    :title="props.title"
    :content="contentProps"
    @after:leave="emit('after:leave')"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UModal>
</template>
