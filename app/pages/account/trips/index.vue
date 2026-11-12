<script setup lang="ts">
import type { TripsTab, TripSummary } from '~/utils/account-types'

/**
 * My trips: upcoming, past, cancelled. Each opens the same booking page as the email link
 * (pay, pre-check-in, cancel...), authorised by the account.
 */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const api = useAccountApi()
const { money } = useMoney()
const { dateRange, date } = useDate()

const tabs = computed(() => (['upcoming', 'past', 'cancelled'] as TripsTab[]).map(v => ({ value: v, label: t(`account.trips.tabs.${v}`) })))
const tab = computed<TripsTab>({
  get: () => (['upcoming', 'past', 'cancelled'].includes(String(route.query.tab)) ? route.query.tab as TripsTab : 'upcoming'),
  set: v => router.replace({ query: { ...route.query, tab: v, page: undefined } }),
})
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const trips = ref<TripSummary[]>([])
const total = ref(0)
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const res = await api.trips(tab.value, page.value)
    trips.value = res.trips
    total.value = res.total
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}
watch([tab, page], load, { immediate: true })

const when = (trip: TripSummary) => (trip.arrival && trip.departure ? dateRange(trip.arrival, trip.departure) : trip.arrival ? date(trip.arrival) : '')
const statusColor = (s: string) => (s === 'confirmed' || s === 'checked_in' || s === 'completed' ? 'success' : s === 'cancelled' || s === 'expired' ? 'neutral' : 'warning')
</script>

<template>
  <MzAccountShell :title="t('account.nav.trips')">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" />
      <UButton :to="localePath('/account/trips/claim')" :label="t('account.claim.cta')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" />
    </div>

    <div v-if="loading" class="flex flex-col gap-4" aria-busy="true">
      <MzSkeleton v-for="i in 3" :key="i" class="h-32" />
    </div>
    <UAlert v-else-if="failed" :title="t('account.errors.generic')" color="error" variant="subtle" role="alert">
      <template #actions><UButton :label="t('account.retry')" size="sm" @click="load" /></template>
    </UAlert>
    <MzEmptyState v-else-if="!trips.length" icon="i-lucide-tent" :title="t(`account.trips.empty.${tab}`)" :description="t('account.trips.emptyText')">
      <UButton :to="localePath('/stays')" :label="t('common.book')" />
    </MzEmptyState>

    <ul v-else class="flex flex-col gap-4">
      <li v-for="trip in trips" :key="trip.reference">
        <article class="grid overflow-hidden rounded-sm ring ring-default sm:grid-cols-[12rem_1fr]">
          <div class="relative aspect-[4/3] bg-elevated sm:aspect-auto">
            <img v-if="trip.cover_url" :src="trip.cover_url" alt="" class="absolute inset-0 size-full object-cover" loading="lazy">
          </div>
          <div class="flex flex-col gap-3 p-6">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="t(`status.${trip.status}`, trip.status)" :color="statusColor(trip.status)" variant="subtle" />
              <span class="text-caption text-muted">{{ trip.reference }}</span>
              <span v-if="tab === 'upcoming' && trip.days_until !== null && trip.days_until >= 0" class="text-caption font-medium text-highlighted">
                · {{ trip.days_until === 0 ? t('account.trips.today') : t('account.trips.inDays', { n: trip.days_until }, trip.days_until) }}
              </span>
            </div>
            <h2 class="font-display text-h3 text-highlighted">{{ trip.products ?? trip.reference }}</h2>
            <p class="text-small text-muted">{{ when(trip) }}</p>
            <ul v-if="tab === 'upcoming'" class="flex flex-wrap gap-x-4 gap-y-1 text-small">
              <li v-if="trip.balance_minor > 0" class="text-warning">{{ t('account.trips.balance', { amount: money(trip.balance_minor, trip.currency) }) }}</li>
              <li v-if="!trip.precheckin_completed" class="text-muted">{{ t('account.trips.precheckinTodo') }}</li>
            </ul>
            <div class="mt-auto flex flex-wrap gap-2 pt-2">
              <UButton :to="localePath(`/booking/${trip.reference}`)" :label="t('account.trips.manage')" size="sm" />
              <UButton
                v-if="tab === 'upcoming' && ['confirmed', 'checked_in'].includes(trip.status)"
                :to="localePath(`/account/trips/${trip.reference}/ticket`)"
                :label="t('account.trips.ticket')"
                icon="i-lucide-qr-code"
                color="neutral"
                variant="outline"
                size="sm"
              />
              <template v-if="tab === 'past' && trip.product_id">
                <UButton :to="localePath('/stays')" :label="t('account.trips.bookAgain')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="sm" />
              </template>
            </div>
          </div>
        </article>
      </li>
    </ul>
    <UPagination
      v-if="total > 20"
      :page="page"
      :total="total"
      :items-per-page="20"
      class="self-center"
      @update:page="(p: number) => router.replace({ query: { ...route.query, page: p } })"
    />
  </MzAccountShell>
</template>
