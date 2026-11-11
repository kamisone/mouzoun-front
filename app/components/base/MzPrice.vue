<script setup lang="ts">
/**
 * A price from integer cents, formatted for the current locale ("1 250,00 €", "€1,250.00").
 * `from` prefixes "From", `unit` adds "per night"... 0 is shown as "Free" unless `showZero`.
 */
const props = withDefaults(defineProps<{
  cents: number
  currency?: string
  from?: boolean
  unit?: 'night' | 'person'
  size?: 'sm' | 'md' | 'lg'
  showZero?: boolean
  /** Drop ",00" for whole amounts (marketing cards). */
  trimZeroCents?: boolean
}>(), { currency: 'EUR', from: false, unit: undefined, size: 'md', showZero: false, trimZeroCents: false })

const { t } = useI18n()
const { money } = useMoney()
const formatted = computed(() => money(props.cents, props.currency, { trimZeroCents: props.trimZeroCents }))
const isFree = computed(() => props.cents === 0 && !props.showZero)
const unitLabel = computed(() => (props.unit === 'night' ? t('common.perNight') : props.unit === 'person' ? t('common.perPerson') : ''))
const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }
</script>

<template>
  <span class="inline-flex flex-wrap items-baseline gap-x-1" data-testid="mz-price">
    <span v-if="props.from && !isFree" class="text-sm text-muted">{{ t('common.from') }}</span>
    <span class="font-semibold text-highlighted tabular-nums" :class="sizes[props.size]">
      {{ isFree ? t('price.free') : formatted }}
    </span>
    <span v-if="unitLabel && !isFree" class="text-sm text-muted">{{ unitLabel }}</span>
  </span>
</template>
