<script setup lang="ts">
import type { BookingRef, CalendarPatch, Night, Unit } from '~/utils/catalog-admin-api'
import { addDays, monthCells, nightsIn, rangeFromClicks } from '~/utils/catalog'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * "Calendrier" tab of a stay: one cell per night (capacity, reserved, available, stop sell,
 * minimum stay, closed to arrival / departure, season colour). Click a first night then a last
 * one to select a range; restrict it to some weekdays; apply stop sell, minimum nights, CTA,
 * CTD and (pool mode) capacity. Closures (the whole stay or one unit) are created here too.
 * Editing needs `inventory.write`; reception and guides read.
 */
const props = defineProps<{ productId: string, canWrite: boolean, inventoryMode: 'unit' | 'pool', units?: Unit[] }>()
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const api = useAdminApi()
const toast = useToast()
const now = new Date()
const month = ref({ y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 })
const first = computed(() => `${month.value.y}-${String(month.value.m).padStart(2, '0')}-01`)
const last = computed(() => addDays(month.value.m === 12 ? `${month.value.y + 1}-01-01` : `${month.value.y}-${String(month.value.m + 1).padStart(2, '0')}-01`, 0))
const { data, refresh } = await useAsyncData(
  () => `catalog-calendar-${props.productId}-${first.value}`,
  () => api.catalog.calendar(props.productId, first.value, last.value),
  { watch: [first] },
)
const byDay = computed(() => Object.fromEntries((data.value?.nights ?? []).map(n => [n.day, n])) as Record<string, Night>)
const seasonColor = (id: string | null) => data.value?.seasons.find(s => s.id === id)?.color ?? undefined
const cells = computed(() => monthCells(month.value.y, month.value.m))
const monthLabel = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${first.value}T12:00:00Z`)))
const weekdayNames = computed(() => [0, 1, 2, 3, 4, 5, 6].map(i => t(`admin.catalog.weekdays.${i}`)))
function shift(by: number) {
  const m = month.value.m + by
  month.value = { y: month.value.y + Math.floor((m - 1) / 12), m: ((m - 1) % 12 + 12) % 12 + 1 }
}

// Range selection: first click = anchor, second click = range, third click starts again.
const anchor = ref<string | null>(null)
const range = ref<{ from: string, to: string } | null>(null)
const days = ref(127)
function click(day: string) {
  if (!props.canWrite) return
  if (!anchor.value || range.value) {
    anchor.value = day
    range.value = null
  }
  else {
    range.value = rangeFromClicks(anchor.value, day)
  }
}
const selected = computed(() => {
  if (range.value) return new Set(nightsIn(range.value.from, range.value.to, days.value))
  return new Set(anchor.value ? [anchor.value] : [])
})
const actions = reactive<{ stop_sell: string, min_nights: number | null, clearMin: boolean, cta: string, ctd: string, capacity: number | null }>({
  stop_sell: 'keep', min_nights: null, clearMin: false, cta: 'keep', ctd: 'keep', capacity: null,
})
const flag = (v: string) => (v === 'keep' ? undefined : v === 'on')
const blocked = ref<{ message: string, bookings: BookingRef[] } | null>(null)
const applying = ref(false)
async function apply() {
  if (!range.value) return
  const body: CalendarPatch = { from: range.value.from, to: range.value.to, days_of_week: days.value }
  if (flag(actions.stop_sell) !== undefined) body.stop_sell = flag(actions.stop_sell)
  if (flag(actions.cta) !== undefined) body.closed_to_arrival = flag(actions.cta)
  if (flag(actions.ctd) !== undefined) body.closed_to_departure = flag(actions.ctd)
  if (actions.clearMin) body.min_nights_override = null
  else if (actions.min_nights) body.min_nights_override = actions.min_nights
  if (props.inventoryMode === 'pool' && actions.capacity != null) body.capacity = actions.capacity
  applying.value = true
  blocked.value = null
  try {
    const out = await api.catalog.patchCalendar(props.productId, body)
    toast.add({ title: t('admin.catalog.calendar.applied', { n: out.nights }), color: 'success' })
    await refresh()
    emit('changed')
  }
  catch (e) {
    const err = apiError(e)
    if (err.details?.bookings) blocked.value = { message: t(`admin.catalog.errors.${err.code}`), bookings: err.details.bookings }
    else toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
  finally {
    applying.value = false
  }
}

// Closures.
const { data: closures, refresh: refreshClosures } = await useAsyncData(`catalog-closures-${props.productId}`, () => api.catalog.closures('stays', props.productId))
const closure = reactive({ reason: '', is_public: false, unit_id: undefined as string | undefined })
async function addClosure() {
  if (!range.value) return
  blocked.value = null
  try {
    await api.catalog.createClosure('stays', props.productId, { from: range.value.from, to: range.value.to, reason: closure.reason || undefined, is_public: closure.is_public, unit_id: closure.unit_id })
    toast.add({ title: t('admin.catalog.saved'), color: 'success' })
    await Promise.all([refreshClosures(), refresh()])
    emit('changed')
  }
  catch (e) {
    const err = apiError(e)
    if (err.details?.bookings) blocked.value = { message: t(`admin.catalog.errors.${err.code}`), bookings: err.details.bookings }
    else toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
}
async function removeClosure(id: string) {
  try {
    await api.catalog.deleteClosure('stays', props.productId, id)
    await Promise.all([refreshClosures(), refresh()])
  }
  catch (e) {
    const err = apiError(e)
    if (err.details?.bookings) blocked.value = { message: t(`admin.catalog.errors.${err.code}`), bookings: err.details.bookings }
  }
}
const TRI = computed(() => [{ value: 'keep', label: t('admin.catalog.calendar.keep') }, { value: 'on', label: t('admin.catalog.calendar.on') }, { value: 'off', label: t('admin.catalog.calendar.off') }])
const { date } = useDate()
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="stay-calendar">
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" class="rtl:rotate-180" :aria-label="t('admin.catalog.calendar.previous')" @click="shift(-1)" />
      <p class="min-w-40 text-center font-medium capitalize">{{ monthLabel }}</p>
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" class="rtl:rotate-180" :aria-label="t('admin.catalog.calendar.next')" @click="shift(1)" />
      <div class="ms-auto flex flex-wrap gap-2 text-caption text-muted">
        <span v-for="s in data?.seasons ?? []" :key="s.id" class="flex items-center gap-1"><span class="size-3 rounded-full" :style="{ backgroundColor: s.color ?? undefined }" />{{ s.name }}</span>
      </div>
    </div>
    <div class="grid grid-cols-7 gap-1" role="grid" :aria-label="monthLabel">
      <div v-for="w in weekdayNames" :key="w" class="text-center text-caption text-muted" role="columnheader">{{ w }}</div>
      <template v-for="(day, i) in cells" :key="i">
        <div v-if="!day" aria-hidden="true" />
        <button
          v-else
          type="button"
          class="relative flex min-h-16 flex-col items-start rounded-xs border p-1 text-start text-caption"
          :class="[selected.has(day) ? 'border-primary bg-primary/10' : 'border-default', byDay[day]?.stop_sell || byDay[day]?.closed ? 'opacity-60' : '']"
          :aria-pressed="selected.has(day)"
          :aria-label="`${date(day)}: ${byDay[day] ? t('admin.catalog.calendar.cellLabel', { available: byDay[day]!.available, capacity: byDay[day]!.capacity }) : t('admin.catalog.calendar.noRow')}`"
          :data-testid="`night-${day}`"
          @click="click(day)"
        >
          <span class="absolute inset-x-0 top-0 h-1 rounded-t-xs" :style="{ backgroundColor: seasonColor(byDay[day]?.season_id ?? null) }" />
          <span class="font-medium">{{ Number(day.slice(8)) }}</span>
          <template v-if="byDay[day]">
            <span class="tabular-nums">{{ byDay[day]!.available }}/{{ byDay[day]!.capacity }}</span>
            <span v-if="byDay[day]!.reserved" class="text-muted">{{ t('admin.catalog.calendar.reservedShort', { n: byDay[day]!.reserved }) }}</span>
            <span class="flex flex-wrap gap-1">
              <UBadge v-if="byDay[day]!.stop_sell" label="STOP" color="error" size="sm" variant="soft" />
              <UBadge v-if="byDay[day]!.closed" :label="t('admin.catalog.calendar.closedShort')" color="error" size="sm" variant="soft" />
              <UBadge v-if="byDay[day]!.min_nights_override" :label="`${byDay[day]!.min_nights_override}n`" color="neutral" size="sm" variant="outline" />
              <UBadge v-if="byDay[day]!.closed_to_arrival" label="CTA" color="warning" size="sm" variant="soft" />
              <UBadge v-if="byDay[day]!.closed_to_departure" label="CTD" color="warning" size="sm" variant="soft" />
            </span>
          </template>
        </button>
      </template>
    </div>
    <MzBlockedBookings v-if="blocked" :message="blocked.message" :bookings="blocked.bookings" />
    <section v-if="props.canWrite" class="flex flex-col gap-3 rounded-md border border-default p-3" :aria-label="t('admin.catalog.calendar.bulk')">
      <p class="text-small" data-testid="calendar-range">
        <template v-if="range">{{ t('admin.catalog.calendar.range', { from: date(range.from), to: date(addDays(range.to, -1)), n: selected.size }) }}</template>
        <template v-else>{{ t('admin.catalog.calendar.pick') }}</template>
      </p>
      <MzWeekdayChips v-model="days" :label="t('admin.catalog.calendar.onlyDays')" />
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <UFormField :label="t('admin.catalog.calendar.stopSell')" name="cal-stop"><USelect v-model="actions.stop_sell" :items="TRI" size="sm" class="w-full" /></UFormField>
        <UFormField :label="t('admin.catalog.calendar.cta')" name="cal-cta"><USelect v-model="actions.cta" :items="TRI" size="sm" class="w-full" /></UFormField>
        <UFormField :label="t('admin.catalog.calendar.ctd')" name="cal-ctd"><USelect v-model="actions.ctd" :items="TRI" size="sm" class="w-full" /></UFormField>
        <UFormField :label="t('admin.catalog.calendar.minNights')" name="cal-min">
          <div class="flex items-center gap-2"><UInputNumber v-model="actions.min_nights" :min="1" size="sm" :disabled="actions.clearMin" /><UCheckbox v-model="actions.clearMin" :label="t('admin.catalog.calendar.clear')" /></div>
        </UFormField>
        <UFormField v-if="props.inventoryMode === 'pool'" :label="t('admin.catalog.calendar.capacity')" name="cal-capacity" :help="t('admin.catalog.calendar.capacityHint')">
          <UInputNumber v-model="actions.capacity" :min="0" size="sm" />
        </UFormField>
      </div>
      <UButton :label="t('admin.catalog.calendar.apply')" :disabled="!range" :loading="applying" class="self-start" data-testid="apply-calendar" @click="apply" />
    </section>
    <section class="flex flex-col gap-2" :aria-label="t('admin.catalog.closures.title')">
      <h3 class="font-medium">{{ t('admin.catalog.closures.title') }}</h3>
      <ul class="flex flex-col gap-1 text-small">
        <li v-for="c in closures?.data ?? []" :key="c.id" class="flex flex-wrap items-center gap-2">
          <span>{{ date(c.from) }} → {{ date(addDays(c.to, -1)) }}</span>
          <UBadge v-if="c.unit_id" :label="props.units?.find(u => u.id === c.unit_id)?.code ?? t('admin.catalog.closures.unit')" size="sm" color="neutral" variant="outline" />
          <span class="text-muted">{{ c.reason }}</span>
          <UBadge v-if="c.is_public" :label="t('admin.catalog.closures.public')" size="sm" color="primary" variant="soft" />
          <UButton v-if="props.canWrite" icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="removeClosure(c.id)" />
        </li>
        <li v-if="!(closures?.data ?? []).length" class="text-muted">{{ t('admin.catalog.closures.none') }}</li>
      </ul>
      <div v-if="props.canWrite" class="flex flex-wrap items-end gap-2">
        <UFormField :label="t('admin.catalog.closures.reason')" name="closure-reason"><UInput v-model="closure.reason" size="sm" class="w-56" /></UFormField>
        <UFormField v-if="props.inventoryMode === 'unit' && props.units?.length" :label="t('admin.catalog.closures.scope')" name="closure-unit">
          <USelect v-model="closure.unit_id" :items="[{ value: undefined, label: t('admin.catalog.closures.wholeStay') }, ...props.units.map(u => ({ value: u.id, label: u.code }))]" size="sm" class="w-40" />
        </UFormField>
        <USwitch v-model="closure.is_public" :label="t('admin.catalog.closures.publicNotice')" class="mb-2" />
        <UButton :label="t('admin.catalog.closures.add')" size="sm" color="neutral" variant="outline" :disabled="!range" @click="addClosure" />
      </div>
    </section>
  </div>
</template>
