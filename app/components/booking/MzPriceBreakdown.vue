<script setup lang="ts">
import type { QuotedItem, TripQuote } from '~/utils/booking-types'

/**
 * "Price details" popover: per-night lines (season, weekday, extra guest), extras, discounts and
 * taxes, straight from the engine's breakdown. The total always equals the sum shown.
 */
const props = withDefaults(defineProps<{
  quote: Pick<TripQuote, 'currency' | 'items' | 'subtotal_minor' | 'discount_minor' | 'discounts' | 'tax_minor' | 'included_tax_minor' | 'total_minor'>
  label?: string
}>(), { label: undefined })
const { t } = useI18n()
const { money } = useMoney()
const { date } = useDate()
const categories = useGuestCategories()

const categoryName = (id: string | null) => categories.data.value?.find(c => c.id === id)?.name ?? ''
const items = computed(() => props.quote.items.filter(i => !i.issue && (i.total_minor > 0 || i.lines.length)))
function lineLabel(item: QuotedItem, l: QuotedItem['lines'][number]) {
  if (l.kind === 'extra_guest') return t('booking.price.extraGuest', { n: l.quantity }, l.quantity)
  if (l.guest_category_id) return `${l.quantity} × ${categoryName(l.guest_category_id)}`
  return item.kind === 'accommodation' ? t('booking.price.units', { n: l.quantity }, l.quantity) : `× ${l.quantity}`
}
</script>

<template>
  <UPopover :content="{ align: 'start' }">
    <button type="button" class="link-underline text-small font-medium text-highlighted">
      {{ props.label ?? t('booking.price.details') }}
    </button>
    <template #content>
      <div class="max-h-[70vh] w-80 max-w-[90vw] overflow-y-auto p-4 text-small" data-testid="price-details">
        <p class="eyebrow pb-3">{{ t('booking.price.details') }}</p>
        <div v-for="item in items" :key="item.index" class="border-b border-default py-3 first:pt-0">
          <p class="flex justify-between gap-3 font-medium text-highlighted">
            <span>{{ item.name }}</span>
            <span class="tabular-nums">{{ money(item.subtotal_minor, props.quote.currency) }}</span>
          </p>
          <ul v-if="item.lines.length > 1 || item.kind === 'accommodation'" class="pt-1 text-muted">
            <li v-for="(l, i) in item.lines" :key="i" class="flex justify-between gap-3">
              <span>{{ date(l.date, 'medium') }} · {{ lineLabel(item, l) }}</span>
              <span class="tabular-nums">{{ money(l.amount_minor, props.quote.currency) }}</span>
            </li>
          </ul>
          <p v-for="d in item.discounts" :key="d.promotion_id + (d.name ?? '')" class="flex justify-between gap-3 text-success">
            <span>{{ d.name ?? d.code ?? t('booking.price.discount') }}</span>
            <span class="tabular-nums">−{{ money(d.amount_minor, props.quote.currency) }}</span>
          </p>
          <p v-for="tax in item.taxes" :key="tax.tax_id" class="flex justify-between gap-3 text-muted">
            <span>{{ tax.inclusive ? t('booking.price.taxIncluded', { name: t(`booking.taxes.${tax.code}`, tax.code) }) : t(`booking.taxes.${tax.code}`, tax.code) }}</span>
            <span class="tabular-nums">{{ tax.inclusive ? '' : '+' }}{{ money(tax.amount_minor, props.quote.currency) }}</span>
          </p>
        </div>
        <p class="flex justify-between gap-3 pt-3 text-body font-medium text-highlighted">
          <span>{{ t('booking.price.total') }}</span>
          <span class="tabular-nums">{{ money(props.quote.total_minor, props.quote.currency) }}</span>
        </p>
        <p class="pt-1 text-caption text-muted">{{ t('booking.price.chargedIn', { currency: props.quote.currency }) }}</p>
      </div>
    </template>
  </UPopover>
</template>
