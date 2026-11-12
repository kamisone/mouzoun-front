<script setup lang="ts">
import type { Party } from '~/composables/useBooking'

/**
 * Dates + guests search. Desktop: two popover fields and a button. Mobile: one field that opens
 * a full-screen sheet (calendar, guests, search). The search goes to the URL (shareable).
 */
const props = withDefaults(defineProps<{
  /** `bar` (hero, header) or `stacked` (inside a card). */
  variant?: 'bar' | 'stacked'
  /** Where the search leads. */
  target?: string
}>(), { variant: 'bar', target: '/stays' })

const { t } = useI18n()
const localePath = useLocalePath()
const { params, last, toQuery, remember } = useSearchParams()
const { data: categories } = useGuestCategories()
const { data: config } = useBookingConfig()
const { dateRange } = useDate()

const dates = ref<{ start: string | null, end: string | null }>({ start: params.value.checkin, end: params.value.checkout })
const party = ref<Party>({ ...params.value.party })
onMounted(() => {
  if (!params.value.checkin) {
    const previous = last()
    if (previous?.checkin && previous.checkin >= new Date().toISOString().slice(0, 10)) {
      dates.value = { start: previous.checkin, end: previous.checkout }
      party.value = previous.party
    }
  }
})

const sheet = ref(false)
const datesLabel = computed(() => (dates.value.start && dates.value.end ? dateRange(dates.value.start, dates.value.end) : t('booking.search.addDates')))
const guestsLabel = computed(() => {
  const n = party.value.adults + party.value.children
  const parts = [t('booking.search.guests', { n }, n)]
  if (party.value.infants) parts.push(t('booking.search.infants', { n: party.value.infants }, party.value.infants))
  return parts.join(', ')
})

async function submit() {
  const p = { checkin: dates.value.start, checkout: dates.value.end, party: party.value }
  remember(p)
  sheet.value = false
  await navigateTo({ path: localePath(props.target), query: toQuery(p) })
}
</script>

<template>
  <form
    role="search"
    :aria-label="t('booking.search.label')"
    class="w-full"
    @submit.prevent="submit"
  >
    <!-- Desktop / tablet -->
    <div
      class="hidden gap-2 md:grid"
      :class="props.variant === 'bar' ? 'grid-cols-[1fr_1fr_auto] items-stretch rounded-sm border border-default bg-elevated p-2' : 'grid-cols-1'"
    >
      <UPopover :content="{ align: 'start' }">
        <button type="button" class="flex flex-col items-start rounded-xs px-4 py-2 text-start hover:bg-muted" data-testid="search-dates">
          <span class="eyebrow">{{ t('booking.search.dates') }}</span>
          <span class="text-body text-highlighted">{{ datesLabel }}</span>
        </button>
        <template #content>
          <div class="p-4">
            <MzAvailabilityCalendar v-model="dates" :show-prices="config?.calendar_show_prices ?? true" :max-days-ahead="config?.max_days_ahead ?? 365" />
          </div>
        </template>
      </UPopover>
      <UPopover :content="{ align: 'start' }">
        <button type="button" class="flex flex-col items-start rounded-xs px-4 py-2 text-start hover:bg-muted" data-testid="search-guests">
          <span class="eyebrow">{{ t('booking.search.who') }}</span>
          <span class="text-body text-highlighted">{{ guestsLabel }}</span>
        </button>
        <template #content>
          <div class="w-96 max-w-[90vw] px-4 py-2">
            <MzGuestPicker v-model="party" :categories="categories ?? []" />
          </div>
        </template>
      </UPopover>
      <UButton type="submit" icon="i-lucide-search" :label="t('common.search')" size="lg" class="justify-center" />
    </div>

    <!-- Mobile: a single field opening a full-screen sheet -->
    <button
      type="button"
      class="flex w-full items-center gap-3 rounded-full border border-default bg-elevated px-6 py-3 text-start md:hidden"
      :aria-label="t('booking.search.open')"
      @click="sheet = true"
    >
      <UIcon name="i-lucide-search" class="size-5 text-muted" aria-hidden="true" />
      <span class="flex min-w-0 flex-col">
        <span class="text-small font-medium text-highlighted">{{ datesLabel }}</span>
        <span class="truncate text-caption text-muted">{{ guestsLabel }}</span>
      </span>
    </button>
    <UModal
      v-model:open="sheet"
      fullscreen
      :title="t('booking.search.label')"
      :ui="{ content: 'rounded-none ring-0 shadow-none', body: 'flex flex-col gap-8 pb-32' }"
    >
      <template #body>
        <section>
          <h2 class="eyebrow pb-3">{{ t('booking.search.dates') }}</h2>
          <MzAvailabilityCalendar v-model="dates" :show-prices="config?.calendar_show_prices ?? true" :max-days-ahead="config?.max_days_ahead ?? 365" />
        </section>
        <section>
          <h2 class="eyebrow pb-1">{{ t('booking.search.who') }}</h2>
          <MzGuestPicker v-model="party" :categories="categories ?? []" />
        </section>
        <div class="fixed inset-x-0 bottom-0 border-t border-default bg-default p-4">
          <UButton :label="t('common.search')" icon="i-lucide-search" size="lg" block @click="submit" />
        </div>
      </template>
    </UModal>
  </form>
</template>
