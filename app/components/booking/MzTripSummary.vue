<script setup lang="ts">
import type { PaymentOption, TripQuote } from '~/utils/booking-types'

/**
 * Sticky summary of a trip (basket, checkout): items with dates and guests, line totals,
 * discount, taxes, total, what is due today and later, and the approximate amount in the
 * display currency (always labelled "approx.", the charge is in EUR).
 */
const props = withDefaults(defineProps<{
  quote: TripQuote
  paymentOption?: PaymentOption | null
  /** Dirhams per euro, for the "approx." line (display only). */
  madRate?: number | null
}>(), { paymentOption: null, madRate: null })
const { t } = useI18n()
const { money } = useMoney()
const { date, dateRange, dateTime } = useDate()

const items = computed(() => props.quote.items.filter(i => !i.issue && !i.in_package))
const choice = computed(() => props.quote.payment_options.find(o => o.option === props.paymentOption) ?? null)
function when(i: TripQuote['items'][number]) {
  if (i.arrival && i.departure) return dateRange(i.arrival, i.departure)
  if (i.starts_at) return dateTime(i.starts_at)
  if (i.date) return date(i.date)
  return ''
}
const guests = (i: TripQuote['items'][number]) => i.guests.reduce((n, g) => n + g.count, 0)
</script>

<template>
  <aside class="flex flex-col gap-4 rounded-sm border border-default bg-elevated p-6" :aria-label="t('booking.summary.title')" data-testid="trip-summary">
    <h2 class="text-h3">{{ t('booking.summary.title') }}</h2>
    <ul class="flex flex-col divide-y divide-default">
      <li v-for="i in items" :key="i.index" class="flex justify-between gap-4 py-3 first:pt-0">
        <div class="min-w-0">
          <p class="font-medium text-highlighted" :class="{ 'ps-4 text-small': i.parent_index != null }">
            {{ i.name }}<span v-if="i.quantity > 1 && i.kind !== 'activity'"> × {{ i.quantity }}</span>
          </p>
          <p class="text-small text-muted">
            {{ when(i) }}<template v-if="guests(i) && i.kind !== 'extra'"> · {{ t('booking.search.guests', { n: guests(i) }, guests(i)) }}</template>
          </p>
          <p v-if="i.mandatory" class="text-caption text-muted">{{ t('booking.summary.included') }}</p>
          <p v-if="i.on_request" class="text-caption text-warning">{{ t('booking.summary.onRequest') }}</p>
        </div>
        <span class="shrink-0 text-small tabular-nums text-highlighted">{{ i.total_minor ? money(i.total_minor, props.quote.currency) : t('price.free') }}</span>
      </li>
    </ul>
    <dl class="flex flex-col gap-1 border-t border-default pt-4 text-small">
      <div v-if="props.quote.discount_minor" class="flex justify-between gap-3 text-success">
        <dt>{{ props.quote.discounts.map(d => d.name ?? d.code).filter(Boolean).join(' · ') || t('booking.price.discount') }}</dt>
        <dd class="tabular-nums">−{{ money(props.quote.discount_minor, props.quote.currency) }}</dd>
      </div>
      <div v-if="props.quote.tax_minor" class="flex justify-between gap-3 text-muted">
        <dt>{{ t('booking.price.taxes') }}</dt>
        <dd class="tabular-nums">+{{ money(props.quote.tax_minor, props.quote.currency) }}</dd>
      </div>
      <div v-if="props.quote.included_tax_minor" class="flex justify-between gap-3 text-muted">
        <dt>{{ t('booking.price.vatIncluded') }}</dt>
        <dd class="tabular-nums">{{ money(props.quote.included_tax_minor, props.quote.currency) }}</dd>
      </div>
      <div class="flex items-baseline justify-between gap-3 pt-2">
        <dt class="text-body font-medium text-highlighted">{{ t('booking.price.total') }}</dt>
        <dd><MzPrice :cents="props.quote.total_minor" :currency="props.quote.currency" size="lg" show-zero /></dd>
      </div>
      <template v-if="choice">
        <div class="flex justify-between gap-3 pt-2 font-medium text-highlighted">
          <dt>{{ t('booking.summary.dueToday') }}</dt>
          <dd class="tabular-nums" data-testid="due-today">{{ money(choice.due_now_minor, props.quote.currency) }}</dd>
        </div>
        <div v-if="choice.due_later_minor" class="flex justify-between gap-3 text-muted">
          <dt>{{ choice.due_later_on ? t('booking.summary.dueOn', { date: date(choice.due_later_on) }) : t('booking.summary.dueAtCamp') }}</dt>
          <dd class="tabular-nums">{{ money(choice.due_later_minor, props.quote.currency) }}</dd>
        </div>
      </template>
    </dl>
    <div class="flex justify-end">
      <MzPriceBreakdown :quote="props.quote" />
    </div>
    <p v-if="props.madRate" class="text-caption text-muted">
      {{ t('booking.summary.approx', { currency: props.quote.currency, amount: money(Math.round(props.quote.total_minor * props.madRate), 'MAD') }) }}
    </p>
  </aside>
</template>
