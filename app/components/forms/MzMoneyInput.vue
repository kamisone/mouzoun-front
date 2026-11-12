<script setup lang="ts">
import { formFieldInjectionKey } from '@nuxt/ui/composables/useFormField'
import { centsToInput, parseMoneyToCents } from '~/utils/i18n-format'

/**
 * Amount input: the person types euros ("120,50" or "120.50"), the model is integer cents
 * (12050), as stored by the API. Invalid text keeps the previous model and flags the field.
 */
const props = withDefaults(defineProps<{
  currency?: string
  min?: number
  placeholder?: string
  disabled?: boolean
}>(), { currency: 'EUR', min: 0, placeholder: '0,00', disabled: false })

const model = defineModel<number | null>({ default: null })
const emit = defineEmits<{ invalid: [text: string] }>()

const { t, locale } = useI18n()
const attrs = useAttrs()
// Inside a UFormField the visible label names the input (an aria-label would replace it):
// the generic name is only a fallback for a bare input.
const field = inject(formFieldInjectionKey, undefined)
const ariaLabel = computed(() => (attrs['aria-label'] as string | undefined) ?? (field?.value?.labelId ? undefined : t('forms.money')))
const { size } = useDensity()
const text = ref(centsToInput(model.value, locale.value))
const invalid = ref(false)

watch(model, (cents) => {
  if (parseMoneyToCents(text.value) !== cents) text.value = centsToInput(cents, locale.value)
})

function onInput(value: string | number) {
  text.value = String(value)
  if (!text.value.trim()) {
    invalid.value = false
    model.value = null
    return
  }
  const cents = parseMoneyToCents(text.value)
  invalid.value = cents === null || cents < props.min
  if (invalid.value) emit('invalid', text.value)
  else model.value = cents
}

/** Normalises the display ("120,5" → "120,50") once the person leaves the field. */
function onBlur() {
  if (!invalid.value && model.value !== null) text.value = centsToInput(model.value, locale.value)
}

const symbol = computed(() =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: props.currency }).formatToParts(0).find(p => p.type === 'currency')?.value ?? props.currency,
)
</script>

<template>
  <UInput
    :model-value="text"
    inputmode="decimal"
    autocomplete="off"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :size="size"
    :color="invalid ? 'error' : undefined"
    :highlight="invalid"
    :aria-invalid="invalid || undefined"
    :aria-label="ariaLabel"
    dir="ltr"
    class="w-full"
    :ui="{ base: 'text-end tabular-nums' }"
    @update:model-value="onInput"
    @blur="onBlur"
  >
    <template #trailing>
      <span class="text-sm text-muted" aria-hidden="true">{{ symbol }}</span>
    </template>
  </UInput>
</template>
