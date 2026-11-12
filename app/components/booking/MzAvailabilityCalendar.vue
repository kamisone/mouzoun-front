<script setup lang="ts">
import { type DateValue, parseDate, today as todayIn } from '@internationalized/date'
import type { AvailabilityCalendar, CalendarDay } from '~/utils/booking-types'
import { campTimeZone, intlLocale } from '~/utils/i18n-format'

/**
 * Arrival → departure range calendar fed by the availability API: unavailable nights are struck
 * through, closed-to-arrival / closed-to-departure days cannot be picked as such, and once an
 * arrival is chosen the days before arrival + minimum stay are disabled with a hint. Optional
 * "from" price per night. Keyboard navigation and labels come from Reka UI (UCalendar); each
 * day also gets a spoken state ("available, from 35 €").
 */
const props = withDefaults(defineProps<{
  /** One accommodation, or every accommodation (aggregate) when omitted. */
  productId?: string
  showPrices?: boolean
  maxDaysAhead?: number
}>(), { productId: undefined, showPrices: true, maxDaysAhead: 365 })

const model = defineModel<{ start: string | null, end: string | null }>({ default: () => ({ start: null, end: null }) })
const { t, locale } = useI18n()
const { money } = useMoney()
const api = useBookingApi()
const desktop = useMediaQuery('(min-width: 1024px)')

const today = todayIn(campTimeZone(new Date())) as DateValue
const maxDate = today.add({ days: props.maxDaysAhead }) as DateValue
const days = ref(new Map<string, CalendarDay>())
const terms = ref<Pick<AvailabilityCalendar, 'min_nights' | 'max_nights' | 'check_in_from' | 'check_out_until'>>({
  min_nights: 1, max_nights: null, check_in_from: null, check_out_until: null,
})
const loaded = new Set<string>()
const loading = ref(false)

/** Loads 4 months of availability from the first day of `from`'s month (once per window). */
async function load(from: DateValue) {
  const start = from.set({ day: 1 })
  const key = `${props.productId ?? 'any'}:${start.toString()}`
  if (loaded.has(key)) return
  loaded.add(key)
  loading.value = true
  try {
    const res = await api.calendar({ product_id: props.productId, from: start.toString(), to: start.add({ months: 4 }).toString() })
    terms.value = res
    for (const d of res.days) days.value.set(d.date, d)
    days.value = new Map(days.value)
  }
  catch {
    loaded.delete(key)
  }
  finally {
    loading.value = false
  }
}

const placeholder = shallowRef<DateValue>(model.value.start ? (parseDate(model.value.start) as DateValue) : today)
watch(placeholder, p => load(p), { immediate: true })
watch(() => props.productId, () => {
  loaded.clear()
  days.value = new Map()
  load(placeholder.value)
})

const value = computed({
  get: () => ({
    start: model.value.start ? parseDate(model.value.start) : undefined,
    end: model.value.end ? parseDate(model.value.end) : undefined,
  }),
  set: (v: { start?: DateValue | null, end?: DateValue | null } | null) => {
    model.value = { start: v?.start?.toString() ?? null, end: v?.end?.toString() ?? null }
  },
})

const picking = computed<'arrival' | 'departure'>(() => (model.value.start && !model.value.end ? 'departure' : 'arrival'))
const info = (date: DateValue) => days.value.get(date.toString())
const minNightsFrom = (start: string) => Math.max(terms.value.min_nights, info(parseDate(start))?.min_nights ?? 1)

function nightsFree(from: DateValue, to: DateValue) {
  for (let d = from; d.compare(to) < 0; d = d.add({ days: 1 })) {
    if (!info(d)?.available) return false
  }
  return true
}

function isDisabled(date: DateValue) {
  if (date.compare(today) < 0 || date.compare(maxDate) > 0) return true
  const day = info(date)
  if (picking.value === 'arrival') return !day?.available || day.closed_to_arrival
  const start = parseDate(model.value.start!)
  if (date.compare(start) <= 0) return !day?.available || day.closed_to_arrival
  const nights = date.compare(start)
  if (nights < minNightsFrom(model.value.start!)) return true
  if (terms.value.max_nights && nights > terms.value.max_nights) return true
  if (day?.closed_to_departure) return true
  return !nightsFree(start, date)
}

const minHint = computed(() => {
  if (picking.value !== 'departure') return null
  const n = minNightsFrom(model.value.start!)
  return n > 1 ? t('booking.calendar.minStay', { n }, n) : null
})

const weekStartsOn = computed(() => {
  try {
    const l = new Intl.Locale(intlLocale(locale.value)) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }, weekInfo?: { firstDay: number } }
    const first = (l.getWeekInfo?.() ?? l.weekInfo)?.firstDay ?? 1
    return (first % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6
  }
  catch {
    return 1 as const
  }
})

function compactPrice(cents: number) {
  return money(cents, 'EUR', { trimZeroCents: true })
}

function spoken(date: DateValue) {
  const day = info(date)
  if (!day || isDisabled(date)) return t('booking.calendar.unavailable')
  return day.price_minor != null && props.showPrices
    ? t('booking.calendar.availableFrom', { price: money(day.price_minor) })
    : t('booking.calendar.available')
}

function clear() {
  model.value = { start: null, end: null }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UCalendar
      v-model="value"
      v-model:placeholder="placeholder"
      range
      :number-of-months="desktop ? 2 : 1"
      :week-starts-on="weekStartsOn"
      :min-value="today"
      :max-value="maxDate"
      :is-date-disabled="isDisabled"
      fixed-weeks
      :ui="{ cellTrigger: 'size-11 flex-col gap-0 rounded-xs data-[selected]:bg-primary data-[selected]:text-inverted data-disabled:line-through' }"
    >
      <template #day="{ day }">
        <span class="text-small leading-none tabular-nums">{{ day.day }}</span>
        <span
          v-if="props.showPrices && info(day)?.price_minor != null && !isDisabled(day)"
          class="text-caption leading-none opacity-70"
          aria-hidden="true"
        >{{ compactPrice(info(day)!.price_minor!) }}</span>
        <span class="sr-only">{{ spoken(day) }}</span>
      </template>
    </UCalendar>
    <div class="flex flex-wrap items-center justify-between gap-3 text-small">
      <p class="text-muted" aria-live="polite">
        <template v-if="minHint">{{ minHint }}</template>
        <template v-else-if="picking === 'departure'">{{ t('booking.calendar.pickDeparture') }}</template>
        <template v-else-if="!model.start">{{ t('booking.calendar.pickArrival') }}</template>
        <template v-else-if="terms.check_in_from">
          {{ t('booking.calendar.times', { in: terms.check_in_from.slice(0, 5), out: (terms.check_out_until ?? '12:00').slice(0, 5) }) }}
        </template>
      </p>
      <button v-if="model.start" type="button" class="link-underline font-medium text-highlighted" @click="clear">
        {{ t('booking.calendar.clear') }}
      </button>
    </div>
    <p v-if="loading" class="sr-only" aria-live="polite">{{ t('common.loading') }}</p>
  </div>
</template>
