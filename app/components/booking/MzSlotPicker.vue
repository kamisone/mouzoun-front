<script setup lang="ts">
import type { Slot, SlotsResponse } from '~/utils/booking-types'

/**
 * Activity departures: a row of dates with open departures, then time chips showing time,
 * places left and guide language. Full or too-late departures stay visible but disabled
 * ("Full"). Keyboard: chips are a radio group.
 */
const props = withDefaults(defineProps<{
  productId: string
  /** Suggest departures within a stay. */
  from?: string
  to?: string
  participants?: number
}>(), { from: undefined, to: undefined, participants: 1 })
const model = defineModel<string | null>({ default: null })
const emit = defineEmits<{ selected: [slot: Slot | null] }>()
const { t, locale } = useI18n()
const api = useBookingApi()
const { date } = useDate()

const start = computed(() => props.from ?? new Date().toISOString().slice(0, 10))
const end = computed(() => {
  if (props.to) return props.to
  const d = new Date(`${start.value}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 60)
  return d.toISOString().slice(0, 10)
})
const { data, pending } = useAsyncData<SlotsResponse | null>(
  () => `slots-${props.productId}-${start.value}-${end.value}`,
  () => api.slots({ product_id: props.productId, from: start.value, to: end.value }).catch(() => null),
  { watch: [start, end, () => props.productId] },
)
const byDay = computed(() => {
  const map = new Map<string, Slot[]>()
  for (const s of data.value?.slots ?? []) map.set(s.date, [...(map.get(s.date) ?? []), s])
  return [...map.entries()]
})
const day = ref<string | null>(null)
watchEffect(() => {
  if (!day.value || !byDay.value.some(([d]) => d === day.value)) {
    day.value = byDay.value.find(([, slots]) => slots.some(s => s.state === 'open'))?.[0] ?? byDay.value[0]?.[0] ?? null
  }
})
const slots = computed(() => byDay.value.find(([d]) => d === day.value)?.[1] ?? [])
const { time } = useDate()
const languageName = (code: string | null) => (code ? new Intl.DisplayNames([locale.value], { type: 'language' }).of(code) ?? code : null)

function choose(s: Slot) {
  if (s.state !== 'open' || s.remaining < props.participants) return
  model.value = s.id
  emit('selected', s)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzSkeleton v-if="pending" class="h-24" />
    <template v-else-if="byDay.length">
      <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" :aria-label="t('booking.slots.days')">
        <button
          v-for="[d, list] in byDay"
          :key="d"
          type="button"
          role="tab"
          :aria-selected="d === day"
          class="flex min-w-16 shrink-0 flex-col items-center rounded-xs border px-3 py-2 text-small"
          :class="d === day ? 'border-inverted bg-inverted text-inverted' : 'border-default text-highlighted'"
          :disabled="!list.some(s => s.state === 'open')"
          @click="day = d"
        >
          <span class="capitalize">{{ date(d, 'weekday') }}</span>
        </button>
      </div>
      <div role="radiogroup" :aria-label="t('booking.slots.times')" class="flex flex-wrap gap-2" data-testid="slot-chips">
        <button
          v-for="s in slots"
          :key="s.id"
          type="button"
          role="radio"
          :aria-checked="model === s.id"
          :disabled="s.state !== 'open' || s.remaining < props.participants"
          class="flex min-h-12 flex-col items-start rounded-xs border px-4 py-2 text-start disabled:cursor-not-allowed disabled:opacity-60"
          :class="model === s.id ? 'border-primary bg-primary/10' : 'border-default'"
          @click="choose(s)"
        >
          <span class="text-body font-medium tabular-nums text-highlighted">{{ time(s.starts_at) }}</span>
          <span class="text-caption text-muted">
            <template v-if="s.state === 'full' || s.remaining === 0">{{ t('booking.slots.full') }}</template>
            <template v-else-if="s.state === 'too_late'">{{ t('booking.slots.tooLate') }}</template>
            <template v-else-if="s.state === 'closed'">{{ t('booking.slots.closed') }}</template>
            <template v-else>{{ t('booking.slots.left', { n: s.remaining }, s.remaining) }}</template>
            <template v-if="s.language"> · {{ languageName(s.language) }}</template>
          </span>
        </button>
      </div>
    </template>
    <p v-else class="text-small text-muted">{{ t('booking.slots.none') }}</p>
  </div>
</template>
