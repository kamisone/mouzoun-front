<script setup lang="ts">
import type { Party } from '~/composables/useBooking'
import type { ProductPage, QuoteResponse, TripItem } from '~/utils/booking-types'

/**
 * Sticky booking box of a product page (right column on desktop; on mobile a bottom bar with the
 * price and "Check availability" that opens the same box in a sheet). The first price shown for
 * a stay is the total for the dates and party, mandatory fees included. While online booking is
 * closed, the box becomes "Opening soon".
 */
const props = defineProps<{ product: ProductPage }>()
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const api = useBookingApi()
const trip = useTrip()
const toast = useToast()
const { params, update } = useSearchParams()
const { data: categories } = useGuestCategories()
const { data: config } = useBookingConfig()
const { money } = useMoney()
const { track } = useAnalytics()

const kind = computed(() => props.product.kind)
const dates = ref({ start: params.value.checkin, end: params.value.checkout })
const party = ref<Party>({ ...params.value.party })
const slotId = ref<string | null>(null)
const activityDate = ref<string | undefined>(params.value.checkin ?? undefined)
const quote = ref<QuoteResponse | null>(null)
const quoting = ref(false)
const adding = ref(false)
const sheet = ref(false)
const open = computed(() => config.value?.enabled === true && props.product.booking_mode !== 'not_bookable')

const maxGuests = computed(() => props.product.accommodation?.max_guests ?? props.product.activity?.max_participants ?? 16)
const guests = computed(() => partyToGuests(party.value, categories.value ?? []))
const participants = computed(() => party.value.adults + party.value.children)
const units = computed(() => Math.max(1, Math.ceil(participants.value / Math.max(1, props.product.accommodation?.max_guests ?? 1))))

const item = computed<TripItem | null>(() => {
  if (!guests.value.length) return null
  if (kind.value === 'accommodation' && dates.value.start && dates.value.end) {
    return { kind: 'stay', product_id: props.product.id, arrival: dates.value.start, departure: dates.value.end, quantity: units.value, guests: guests.value }
  }
  if (kind.value === 'activity') {
    const mode = props.product.activity?.scheduling_mode
    if (mode === 'fixed_slots' && slotId.value) return { kind: 'activity', product_id: props.product.id, slot_id: slotId.value, guests: guests.value }
    if (mode !== 'fixed_slots' && activityDate.value) return { kind: 'activity', product_id: props.product.id, date: activityDate.value, guests: guests.value }
  }
  if (kind.value === 'package' && dates.value.start) {
    return { kind: 'package', product_id: props.product.id, arrival: dates.value.start, guests: guests.value }
  }
  return null
})

watchDebounced(item, async (value) => {
  quote.value = null
  if (!value || !open.value) return
  quoting.value = true
  try {
    quote.value = await api.quote({ items: [value], child_ages: party.value.childAges })
  }
  catch {
    quote.value = null
  }
  finally {
    quoting.value = false
  }
}, { debounce: 250, deep: true, immediate: true })

const quoted = computed(() => quote.value?.quote ?? null)
const issue = computed(() => quoted.value?.items.find(i => i.issue)?.issue ?? null)
const nights = computed(() => (dates.value.start && dates.value.end ? Math.round((Date.parse(dates.value.end) - Date.parse(dates.value.start)) / 86_400_000) : 0))

async function addToTrip(goTo: 'trip' | 'stay') {
  if (!item.value) return
  adding.value = true
  try {
    await trip.add(item.value)
    if (kind.value === 'accommodation') await update({ checkin: dates.value.start, checkout: dates.value.end, party: party.value }, route.path)
    track('add_to_cart', { items: [{ item_id: props.product.id, item_name: props.product.name }], value: (quoted.value?.total_minor ?? 0) / 100, currency: 'EUR' })
    sheet.value = false
    if (goTo === 'trip') await navigateTo(localePath('/trip'))
    else toast.add({ title: t('booking.widget.added'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    adding.value = false
  }
}

const fromPrice = computed(() => props.product.from_price_minor)
function issueText() {
  const i = issue.value
  if (!i) return ''
  return t(`booking.issues.${i.code}`, { ...(i.details ?? {}) }, t('booking.issues.generic'))
}
</script>

<template>
  <div>
    <!-- Desktop: sticky box -->
    <aside class="sticky top-24 hidden flex-col gap-6 rounded-sm border border-default bg-elevated p-6 lg:flex" :aria-label="t('booking.widget.label')" data-testid="booking-widget">
      <template v-if="open">
        <div v-if="quoted && !issue" class="flex flex-col gap-1">
          <MzPrice :cents="quoted.total_minor" size="lg" show-zero />
          <p class="text-small text-muted">
            <template v-if="kind === 'accommodation'">{{ t('booking.widget.forStay', { nights, guests: participants }, nights) }}</template>
            <template v-else>{{ t('booking.widget.forGuests', { n: participants }, participants) }}</template>
          </p>
          <MzPriceBreakdown :quote="quoted" />
        </div>
        <MzPrice v-else-if="fromPrice" :cents="fromPrice" from :unit="kind === 'accommodation' ? 'night' : 'person'" size="lg" />

        <div v-if="kind === 'accommodation' || kind === 'package'" class="flex flex-col gap-2">
          <p class="eyebrow">{{ kind === 'package' ? t('booking.widget.arrival') : t('booking.search.dates') }}</p>
          <MzAvailabilityCalendar
            v-model="dates"
            :product-id="kind === 'accommodation' ? props.product.id : undefined"
            :show-prices="config?.calendar_show_prices ?? true"
            :max-days-ahead="config?.max_days_ahead ?? 365"
          />
        </div>
        <div v-else-if="props.product.activity?.scheduling_mode === 'fixed_slots'" class="flex flex-col gap-2">
          <p class="eyebrow">{{ t('booking.slots.title') }}</p>
          <MzSlotPicker v-model="slotId" :product-id="props.product.id" :participants="participants" />
        </div>
        <UFormField v-else :label="t('booking.widget.date')">
          <UInput v-model="activityDate" type="date" class="w-full" data-testid="widget-date" />
        </UFormField>

        <div>
          <p class="eyebrow">{{ t('booking.search.who') }}</p>
          <MzGuestPicker
            v-model="party"
            :categories="categories ?? []"
            :max-guests="kind === 'accommodation' ? maxGuests * 4 : maxGuests"
            :max-reason="kind === 'accommodation' ? t('booking.widget.sleeps', { n: props.product.accommodation?.max_guests }) : undefined"
          />
          <p v-if="kind === 'accommodation' && units > 1" class="text-small text-muted">{{ t('booking.widget.units', { n: units, name: props.product.name }, units) }}</p>
        </div>

        <p v-if="issue" role="alert" class="text-small text-warning" data-testid="widget-issue">{{ issueText() }}</p>
        <div class="flex flex-col gap-2">
          <UButton
            :label="quoted?.is_request ? t('booking.rate.requestCta') : t('booking.widget.reserve')"
            :loading="adding || quoting"
            :disabled="!quoted || !!issue"
            size="xl"
            block
            data-testid="widget-reserve"
            @click="addToTrip('trip')"
          />
          <button v-if="quoted && !issue" type="button" class="link-underline self-center text-small font-medium text-highlighted" @click="addToTrip('stay')">
            {{ t('booking.widget.addAndContinue') }}
          </button>
          <p class="text-center text-caption text-muted">{{ t('booking.rate.notChargedYet') }}</p>
        </div>
        <MzCancellationSummary v-if="quoted && !issue" :steps="quoted.cancellation" compact />
      </template>
      <template v-else>
        <p class="eyebrow">{{ t('booking.closed.eyebrow') }}</p>
        <p class="text-h3">{{ t('booking.closed.title') }}</p>
        <p class="text-small text-muted">{{ t('booking.closed.text') }}</p>
        <UButton :to="`${localePath('/')}#book`" :label="t('booking.closed.cta')" color="neutral" variant="outline" block />
      </template>
    </aside>

    <!-- Mobile: bottom bar + sheet -->
    <div class="fixed inset-x-0 bottom-0 z-(--z-sticky) flex items-center justify-between gap-4 border-t border-default bg-default px-6 py-3 lg:hidden">
      <div class="min-w-0">
        <MzPrice v-if="quoted && !issue" :cents="quoted.total_minor" show-zero />
        <MzPrice v-else-if="fromPrice" :cents="fromPrice" from :unit="kind === 'accommodation' ? 'night' : 'person'" />
        <p v-if="quoted && kind === 'accommodation'" class="text-caption text-muted">{{ t('booking.widget.forStay', { nights, guests: participants }, nights) }}</p>
      </div>
      <UButton
        :label="open ? t('booking.widget.check') : t('booking.closed.eyebrow')"
        :disabled="!open"
        size="lg"
        data-testid="widget-open"
        @click="sheet = true"
      />
    </div>
    <UModal v-model:open="sheet" fullscreen :title="props.product.name" :ui="{ content: 'rounded-none ring-0 shadow-none', body: 'flex flex-col gap-8 pb-40' }">
      <template #body>
        <section v-if="kind === 'accommodation' || kind === 'package'">
          <h2 class="eyebrow pb-3">{{ t('booking.search.dates') }}</h2>
          <MzAvailabilityCalendar v-model="dates" :product-id="kind === 'accommodation' ? props.product.id : undefined" :show-prices="config?.calendar_show_prices ?? true" />
        </section>
        <section v-else-if="props.product.activity?.scheduling_mode === 'fixed_slots'">
          <h2 class="eyebrow pb-3">{{ t('booking.slots.title') }}</h2>
          <MzSlotPicker v-model="slotId" :product-id="props.product.id" :participants="participants" />
        </section>
        <UFormField v-else :label="t('booking.widget.date')">
          <UInput v-model="activityDate" type="date" class="w-full" />
        </UFormField>
        <section>
          <h2 class="eyebrow">{{ t('booking.search.who') }}</h2>
          <MzGuestPicker v-model="party" :categories="categories ?? []" :max-guests="kind === 'accommodation' ? maxGuests * 4 : maxGuests" />
        </section>
        <p v-if="issue" role="alert" class="text-small text-warning">{{ issueText() }}</p>
        <div class="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-default bg-default p-4">
          <p v-if="quoted && !issue" class="flex items-baseline justify-between">
            <span class="text-small text-muted">{{ t('booking.price.total') }}</span>
            <span class="font-medium tabular-nums text-highlighted">{{ money(quoted.total_minor) }}</span>
          </p>
          <UButton :label="t('booking.widget.reserve')" :loading="adding || quoting" :disabled="!quoted || !!issue" size="lg" block @click="addToTrip('trip')" />
        </div>
      </template>
    </UModal>
  </div>
</template>
