<script setup lang="ts">
import type { SearchOption } from '~/utils/booking-types'

/**
 * One rate plan of an accommodation for the searched dates (Flexible, Non-refundable, Half
 * board...): total for the stay with mandatory fees, what is included, cancellation with the
 * exact date, how and when to pay, honest scarcity. Side by side with the other plans.
 */
const props = withDefaults(defineProps<{
  option: SearchOption
  currency: string
  nights: number
  urgencyThreshold?: number
  /** Units booked by this option (units left before booking = remaining after + quantity). */
  quantity?: number
  loading?: boolean
}>(), { urgencyThreshold: 0, quantity: 1, loading: false })
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
const { money } = useMoney()

const name = computed(() => props.option.rate_plan?.name ?? t('booking.rate.standard'))
const meal = computed(() => {
  const m = props.option.rate_plan?.meal_plan
  return m && m !== 'none' ? t(`booking.meal.${m}`) : null
})
const payment = computed(() => {
  const opts = props.option.payment_options
  const deposit = opts.find(o => o.option === 'deposit')
  if (props.option.is_request) return t('booking.rate.request')
  if (opts.length === 1 && opts[0]!.option === 'on_site') return t('booking.rate.payAtCamp')
  if (deposit) return t('booking.rate.depositToday', { amount: money(deposit.due_now_minor, props.currency) })
  if (opts.some(o => o.option === 'on_site')) return t('booking.rate.noPrepayment')
  return t('booking.rate.payNow')
})
// Honest urgency only: the real number of units left, and only under the camp's threshold.
const left = computed(() => (props.option.remaining == null ? null : props.option.remaining + props.quantity))
const scarce = computed(() => left.value != null && left.value > 0 && left.value <= props.urgencyThreshold)
</script>

<template>
  <article class="flex flex-col gap-4 rounded-sm border border-default bg-elevated p-6" data-testid="rate-option">
    <header class="flex flex-col gap-1">
      <h3 class="text-h3">{{ name }}</h3>
      <p v-if="meal" class="text-small text-muted">{{ meal }}</p>
    </header>
    <MzCancellationSummary :steps="props.option.cancellation" compact />
    <p class="flex items-center gap-2 text-small text-default">
      <UIcon name="i-lucide-wallet" class="size-4 text-muted" aria-hidden="true" />
      {{ payment }}
    </p>
    <div class="mt-auto flex flex-col gap-1 border-t border-default pt-4">
      <p v-if="props.option.discounts.length" class="text-small text-success">
        {{ props.option.discounts.map(d => d.name ?? d.code).filter(Boolean).join(' · ') }}
        −{{ money(props.option.discount_minor, props.currency) }}
      </p>
      <p class="flex items-baseline justify-between gap-3">
        <span class="text-small text-muted">{{ t('booking.rate.total', { n: props.nights }, props.nights) }}</span>
        <MzPrice :cents="props.option.total_minor" :currency="props.currency" size="lg" show-zero />
      </p>
      <p class="flex items-baseline justify-between gap-3 text-small text-muted">
        <span>{{ t('booking.rate.perNight', { price: money(props.option.per_night_minor, props.currency) }) }}</span>
        <MzPriceBreakdown :quote="{ currency: props.currency, ...props.option }" />
      </p>
      <p v-if="props.option.tax_minor > 0" class="text-caption text-muted">
        {{ t('booking.rate.taxesAdded', { amount: money(props.option.tax_minor, props.currency) }) }}
      </p>
      <p v-if="scarce" class="text-small font-medium text-warning" data-testid="scarcity">
        {{ t('booking.rate.onlyLeft', { n: left! }, left!) }}
      </p>
    </div>
    <UButton
      :label="props.option.is_request ? t('booking.rate.requestCta') : t('booking.rate.reserve')"
      :loading="props.loading"
      block
      size="lg"
      data-testid="rate-reserve"
      @click="emit('select')"
    />
    <p v-if="props.option.payment_options.some(o => o.due_now_minor === 0)" class="text-center text-caption text-muted">
      {{ t('booking.rate.notChargedYet') }}
    </p>
  </article>
</template>
