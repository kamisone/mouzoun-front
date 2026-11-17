<script setup lang="ts">
import type { ProductOption, ShopVariant } from '~/utils/shop-types'

/**
 * Option buttons, colour/image swatches or a dropdown (the option's `display_type`) choosing a
 * variant. A value that cannot form an available combination with the other chosen values is
 * disabled (still visible, with "not available").
 * v-model is the selected variant id.
 */
const props = defineProps<{ options: ProductOption[], variants: ShopVariant[] }>()
const model = defineModel<string | null>({ default: null })
const { t } = useI18n()

const selected = computed<Record<string, string>>(() => props.variants.find(v => v.id === model.value)?.options ?? {})

/** The variant matching `choice` exactly, if any. */
function variantFor(choice: Record<string, string>) {
  return props.variants.find(v => props.options.every(o => v.options[o.code] === choice[o.code]))
}

/** Can `value` of `option` combine with the current other choices into an available variant? */
function enabled(option: string, value: string) {
  const choice = { ...selected.value, [option]: value }
  return props.variants.some(v =>
    props.options.every(o => o.code === option ? v.options[o.code] === value : !choice[o.code] || v.options[o.code] === choice[o.code])
    && v.availability !== 'out_of_stock')
}

function exists(option: string, value: string) {
  return props.variants.some(v => v.options[option] === value)
}

function choose(option: string, value: string) {
  const choice = { ...selected.value, [option]: value }
  const exact = variantFor(choice)
  // Keep the new value; when that exact combination is missing or sold out, prefer an available
  // variant with it (a sold-out one is still shown: its page offers "notify me").
  const available = props.variants.find(v => v.options[option] === value && v.availability !== 'out_of_stock')
  const chosen = exact && exact.availability !== 'out_of_stock' ? exact : (available ?? exact ?? props.variants.find(v => v.options[option] === value))
  model.value = chosen?.id ?? model.value
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="variant-picker">
    <fieldset v-for="option in props.options" :key="option.code" class="flex flex-col gap-2">
      <legend class="mb-2 text-small font-medium text-highlighted">
        {{ option.name }}
        <span class="font-normal text-muted">· {{ option.values.find(v => v.code === selected[option.code])?.label }}</span>
      </legend>
      <!-- Dropdown: long lists (unavailable combinations stay listed, disabled). -->
      <USelect
        v-if="option.display_type === 'dropdown'"
        :model-value="selected[option.code]"
        :items="option.values.filter(v => exists(option.code, v.code)).map(v => ({ value: v.code, label: enabled(option.code, v.code) ? v.label : `${v.label} · ${t('shop.product.unavailableCombo')}`, disabled: !enabled(option.code, v.code) }))"
        :aria-label="t('shop.product.choose', { option: option.name })"
        class="w-full max-w-xs"
        @update:model-value="(code: string) => choose(option.code, code)"
      />
      <div v-else class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('shop.product.choose', { option: option.name })">
        <template v-for="value in option.values.filter(v => exists(option.code, v.code))" :key="value.code">
          <!-- Swatch: a colour or picture disc, the label in the tooltip and the legend. -->
          <button
            v-if="option.display_type === 'swatch' && (value.swatch_color || value.swatch_url)"
            type="button"
            role="radio"
            :aria-checked="selected[option.code] === value.code"
            :aria-disabled="!enabled(option.code, value.code)"
            :aria-label="value.label"
            :data-disabled="!enabled(option.code, value.code) || undefined"
            :title="enabled(option.code, value.code) ? value.label : `${value.label} · ${t('shop.product.unavailableCombo')}`"
            class="relative size-11 rounded-full border-2 p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="[
              selected[option.code] === value.code ? 'border-inverted' : 'border-default hover:border-inverted',
              !enabled(option.code, value.code) && 'opacity-40',
            ]"
            @click="choose(option.code, value.code)"
          >
            <img v-if="value.swatch_url" :src="value.swatch_url" alt="" class="size-full rounded-full object-cover">
            <span v-else class="block size-full rounded-full" :style="{ backgroundColor: value.swatch_color ?? undefined }" />
          </button>
          <button
            v-else
            type="button"
            role="radio"
            :aria-checked="selected[option.code] === value.code"
            :aria-disabled="!enabled(option.code, value.code)"
            :data-disabled="!enabled(option.code, value.code) || undefined"
            :title="enabled(option.code, value.code) ? value.label : `${value.label} · ${t('shop.product.unavailableCombo')}`"
            class="min-h-11 rounded-full border px-4 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="[
              selected[option.code] === value.code ? 'border-inverted bg-inverted text-inverted' : 'border-default text-highlighted hover:border-inverted',
              !enabled(option.code, value.code) && 'text-dimmed line-through decoration-1',
            ]"
            @click="choose(option.code, value.code)"
          >
            <img v-if="value.swatch_url" :src="value.swatch_url" alt="" class="me-2 inline size-5 rounded-full object-cover align-middle">
            <span v-else-if="value.swatch_color" class="me-2 inline-block size-4 rounded-full border border-default align-middle" :style="{ backgroundColor: value.swatch_color }" />
            {{ value.label }}
          </button>
        </template>
      </div>
    </fieldset>
  </div>
</template>
