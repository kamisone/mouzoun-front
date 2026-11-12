<script setup lang="ts">
/**
 * − value + stepper (44 px touch targets). The value is announced by screen readers through
 * the labelled group; limits disable the buttons instead of silently ignoring a press.
 */
const props = withDefaults(defineProps<{
  label: string
  description?: string
  min?: number
  max?: number
  /** Why `max` is reached ("This tent sleeps up to 4 guests"). */
  maxReason?: string
}>(), { description: undefined, min: 0, max: 99, maxReason: undefined })

const model = defineModel<number>({ default: 0 })
const { t } = useI18n()
const id = useId()
const set = (v: number) => {
  model.value = Math.min(props.max, Math.max(props.min, v))
}
</script>

<template>
  <div class="flex items-center justify-between gap-4 py-3" role="group" :aria-labelledby="`${id}-label`">
    <div class="min-w-0">
      <p :id="`${id}-label`" class="text-body font-medium text-highlighted">{{ props.label }}</p>
      <p v-if="props.description" class="text-small text-muted">{{ props.description }}</p>
      <p v-if="props.maxReason && model >= props.max" class="text-small text-muted" aria-live="polite">{{ props.maxReason }}</p>
    </div>
    <div class="flex shrink-0 items-center gap-3">
      <UButton
        icon="i-lucide-minus"
        color="neutral"
        variant="outline"
        square
        class="size-11 justify-center rounded-full"
        :disabled="model <= props.min"
        :aria-label="t('booking.decrease', { label: props.label })"
        @click="set(model - 1)"
      />
      <output class="w-6 text-center text-body font-medium tabular-nums text-highlighted" aria-live="polite">{{ model }}</output>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        square
        class="size-11 justify-center rounded-full"
        :disabled="model >= props.max"
        :aria-label="t('booking.increase', { label: props.label })"
        @click="set(model + 1)"
      />
    </div>
  </div>
</template>
