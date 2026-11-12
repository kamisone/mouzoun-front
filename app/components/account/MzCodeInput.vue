<script setup lang="ts">
/**
 * Six-digit one-time code: six boxes that behave like one field. Typing moves forward, Backspace
 * goes back, arrows move, pasting (or the SMS / email autofill of `autocomplete="one-time-code"`)
 * fills every box. Digits always run left to right, also in Arabic. Emits `complete` with the
 * code once the six digits are in.
 */
const props = withDefaults(defineProps<{
  label: string
  length?: number
  disabled?: boolean
  invalid?: boolean
  describedby?: string
}>(), { length: 6, disabled: false, invalid: false, describedby: undefined })
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ complete: [code: string] }>()
const { t } = useI18n()
const id = useId()
const boxes = ref<HTMLInputElement[]>([])

const digits = computed(() => Array.from({ length: props.length }, (_, i) => model.value[i] ?? ''))

function set(value: string) {
  const clean = value.replace(/\D/g, '').slice(0, props.length)
  model.value = clean
  if (clean.length === props.length) emit('complete', clean)
}

function focus(i: number) {
  const el = boxes.value[Math.max(0, Math.min(props.length - 1, i))]
  el?.focus()
  el?.select()
}

function onInput(i: number, event: Event) {
  const el = event.target as HTMLInputElement
  const typed = el.value.replace(/\D/g, '')
  if (typed.length > 1) {
    // Autofill or paste into one box: spread from here.
    set(model.value.slice(0, i) + typed)
    focus(i + typed.length)
    return
  }
  const next = digits.value.slice()
  next[i] = typed
  set(next.join('').slice(0, props.length))
  el.value = typed
  if (typed) focus(i + 1)
}

function onKeydown(i: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[i] && i > 0) {
    event.preventDefault()
    const next = digits.value.slice()
    next[i - 1] = ''
    model.value = next.join('')
    focus(i - 1)
  }
  else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focus(i - 1)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    focus(i + 1)
  }
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/\d/.test(text)) return
  event.preventDefault()
  set(text)
  focus(Math.min(text.replace(/\D/g, '').length, props.length - 1))
}

defineExpose({ focus: () => focus(Math.min(model.value.length, props.length - 1)) })
</script>

<template>
  <fieldset class="flex flex-col gap-2" :aria-describedby="props.describedby">
    <legend :id="`${id}-label`" class="mb-2 text-small font-medium text-highlighted">{{ props.label }}</legend>
    <div class="flex gap-2" dir="ltr" @paste="onPaste">
      <input
        v-for="(d, i) in digits"
        :key="i"
        ref="boxes"
        :value="d"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :maxlength="i === 0 ? props.length : 1"
        :autocomplete="i === 0 ? 'one-time-code' : 'off'"
        :aria-label="t('account.code.digit', { n: i + 1, total: props.length })"
        :aria-invalid="props.invalid || undefined"
        :disabled="props.disabled"
        class="size-12 rounded-sm border bg-default text-center font-mono text-h3 text-highlighted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--ui-primary) disabled:opacity-60 sm:size-14"
        :class="props.invalid ? 'border-error' : 'border-accented'"
        :data-testid="`code-${i}`"
        @input="onInput(i, $event)"
        @keydown="onKeydown(i, $event)"
        @focus="($event.target as HTMLInputElement).select()"
      >
    </div>
  </fieldset>
</template>
