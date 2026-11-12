<script setup lang="ts">
import type { ProductCard, SearchOption, SearchResult } from '~/utils/booking-types'

/**
 * Stays for the searched dates and party: total for the stay (mandatory fees included) with
 * "x nights, y guests" under it; expanding a stay shows its rate plans side by side.
 * Unavailable stays stay visible, greyed, with the nearest free dates. Without dates: every
 * stay with its "from" price.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const api = useBookingApi()
const trip = useTrip()
const toast = useToast()
const { params, update } = useSearchParams()
const { data: categories } = useGuestCategories()
const { data: config } = useBookingConfig()
const { dateRange } = useDate()
const { money } = useMoney()
const { track } = useAnalytics()

useSeo({ title: () => `${t('booking.stays.title')} · ${t('common.siteName')}`, description: () => t('booking.stays.description') })

const hasDates = computed(() => !!(params.value.checkin && params.value.checkout))
const guests = computed(() => partyToGuests(params.value.party, categories.value ?? []))
const { data: cards } = await useAsyncData('stays-cards', () => api.products({ kind: 'accommodation' }).catch(() => [] as ProductCard[]), { default: () => [] })
const { data: search, pending, error } = await useAsyncData(
  () => `stays-search-${params.value.checkin}-${params.value.checkout}-${JSON.stringify(guests.value)}`,
  () => (hasDates.value && guests.value.length
    ? api.search({ arrival: params.value.checkin!, departure: params.value.checkout!, guests: guests.value, child_ages: params.value.party.childAges })
    : Promise.resolve(null)),
  { watch: [() => params.value, guests] },
)
watch(search, (s) => {
  if (s) track('view_item_list', { item_list_name: 'stays', items: s.results.map(r => ({ item_id: r.product.id, item_name: r.product.name })) })
}, { immediate: true })

const sort = ref<'recommended' | 'price' | 'rating'>('recommended')
const kind = ref<string>('all')
const kinds = computed(() => [...new Set((search.value?.results ?? []).map(r => String(r.product.facts.accommodation_kind ?? '')).filter(Boolean))])
const cheapest = (r: SearchResult) => Math.min(...r.options.map(o => o.total_minor), Number.MAX_SAFE_INTEGER)
const results = computed(() => {
  const list = (search.value?.results ?? []).filter(r => kind.value === 'all' || r.product.facts.accommodation_kind === kind.value)
  const sorted = [...list]
  if (sort.value === 'price') sorted.sort((a, b) => cheapest(a) - cheapest(b))
  if (sort.value === 'rating') sorted.sort((a, b) => (b.product.rating?.average ?? 0) - (a.product.rating?.average ?? 0))
  return sorted.sort((a, b) => Number(b.available) - Number(a.available))
})
const expanded = ref<string | null>(null)
const selecting = ref<string | null>(null)
const guestsCount = computed(() => params.value.party.adults + params.value.party.children)

async function choose(result: SearchResult, option: SearchOption) {
  selecting.value = `${result.product.id}-${option.rate_plan?.id}`
  try {
    if (option.rate_plan) await trip.setOptions({ rate_plan_id: option.rate_plan.id })
    await trip.add({
      kind: 'stay',
      product_id: result.product.id,
      arrival: params.value.checkin!,
      departure: params.value.checkout!,
      quantity: result.quantity,
      guests: guests.value,
    })
    track('select_item', { items: [{ item_id: result.product.id, item_name: result.product.name, item_variant: option.rate_plan?.code }] })
    await navigateTo(localePath('/trip'))
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    selecting.value = null
  }
}

function useDates(r: SearchResult) {
  if (!r.nearest) return
  update({ ...params.value, checkin: r.nearest.arrival, checkout: r.nearest.departure })
}
const issueText = (r: SearchResult) => (r.issue ? t(`booking.issues.${r.issue.code}`, { ...(r.issue.details ?? {}) }, t('booking.issues.generic')) : '')
</script>

<template>
  <div>
    <MzContainer class="flex flex-col gap-8 pt-12 pb-8 lg:pt-16">
      <header class="flex flex-col gap-3">
        <p class="eyebrow">{{ t('booking.stays.eyebrow') }}</p>
        <h1 class="text-display-lg">{{ t('booking.stays.title') }}</h1>
        <p v-if="hasDates" class="text-body-lg text-muted" data-testid="search-summary">
          {{ dateRange(params.checkin!, params.checkout!) }} · {{ t('booking.search.guests', { n: guestsCount }, guestsCount) }}
        </p>
      </header>
      <MzSearchBar />
      <UAlert
        v-if="config && !config.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-calendar-clock"
        :title="t('booking.closed.title')"
        :description="t('booking.closed.text')"
      />
    </MzContainer>

    <MzContainer class="pb-24">
      <template v-if="hasDates">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-default pb-4">
          <div class="flex flex-wrap gap-2" role="group" :aria-label="t('booking.stays.filterType')">
            <UButton :label="t('booking.stays.allTypes')" size="sm" :variant="kind === 'all' ? 'solid' : 'outline'" color="neutral" @click="kind = 'all'" />
            <UButton
              v-for="k in kinds"
              :key="k"
              :label="t(`booking.kinds.${k}`, k)"
              size="sm"
              :variant="kind === k ? 'solid' : 'outline'"
              color="neutral"
              @click="kind = k"
            />
          </div>
          <USelect
            v-model="sort"
            :items="[{ label: t('booking.stays.sortRecommended'), value: 'recommended' }, { label: t('booking.stays.sortPrice'), value: 'price' }, { label: t('booking.stays.sortRating'), value: 'rating' }]"
            :aria-label="t('booking.stays.sort')"
            class="w-56"
          />
        </div>

        <div v-if="pending" class="flex flex-col gap-6 pt-8">
          <MzSkeleton v-for="n in 3" :key="n" class="h-48" />
        </div>
        <MzEmptyState v-else-if="error" icon="i-lucide-cloud-off" :title="t('booking.errors.generic')" :description="t('booking.errors.retry')" />
        <ul v-else class="flex flex-col divide-y divide-default" data-testid="search-results">
          <li v-for="r in results" :key="r.product.id" class="py-8" :class="{ 'opacity-70': !r.available }" :data-testid="`result-${r.product.slug}`">
            <div class="grid gap-6 md:grid-cols-12">
              <NuxtLink :to="localePath(`/stays/${r.product.slug}`)" class="md:col-span-4" :tabindex="-1" aria-hidden="true">
                <MzImage v-if="r.product.cover" :src="r.product.cover.url" :alt="r.product.cover.alt ?? r.product.name" ratio="3/2" sizes="xs:100vw md:33vw" rounded />
                <div v-else class="aspect-3/2 rounded-sm bg-muted" />
              </NuxtLink>
              <div class="flex flex-col gap-3 md:col-span-5">
                <h2 class="text-h2"><NuxtLink :to="localePath(`/stays/${r.product.slug}`)" class="hover:opacity-80">{{ r.product.name }}</NuxtLink></h2>
                <p v-if="r.product.short_description" class="text-muted">{{ r.product.short_description }}</p>
                <p class="flex flex-wrap gap-x-4 gap-y-1 text-small text-highlighted">
                  <span v-if="r.product.facts.max_guests">{{ t('booking.facts.sleeps', { n: r.product.facts.max_guests }) }}</span>
                  <span v-if="r.product.facts.surface_m2">{{ t('booking.facts.surface', { n: Number(r.product.facts.surface_m2) }) }}</span>
                  <span v-if="r.product.rating">★ {{ r.product.rating.average }} ({{ r.product.rating.count }})</span>
                </p>
                <p v-if="r.quantity > 1 && r.available" class="text-small text-muted">{{ t('booking.widget.units', { n: r.quantity, name: r.product.name }, r.quantity) }}</p>
              </div>
              <div class="flex flex-col items-start gap-2 md:col-span-3 md:items-end md:text-end">
                <template v-if="r.available">
                  <MzPrice :cents="cheapest(r)" size="lg" show-zero />
                  <p class="text-small text-muted">{{ t('booking.stays.forStay', { nights: r.nights, guests: guestsCount }, r.nights) }}</p>
                  <p v-if="r.options[0]" class="text-caption text-muted">{{ t('booking.rate.perNight', { price: money(r.options[0].per_night_minor) }) }}</p>
                  <UButton
                    :label="expanded === r.product.id ? t('booking.stays.hideRates') : t('booking.stays.seeRates', { n: r.options.length }, r.options.length)"
                    :aria-expanded="expanded === r.product.id"
                    :aria-controls="`rates-${r.product.id}`"
                    trailing-icon="i-lucide-chevron-down"
                    data-testid="see-rates"
                    @click="expanded = expanded === r.product.id ? null : r.product.id"
                  />
                </template>
                <template v-else>
                  <p class="text-small font-medium text-highlighted">{{ issueText(r) }}</p>
                  <template v-if="r.nearest">
                    <p class="text-small text-muted">{{ t('booking.stays.nearest', { dates: dateRange(r.nearest.arrival, r.nearest.departure) }) }}</p>
                    <UButton :label="t('booking.stays.useDates')" color="neutral" variant="outline" @click="useDates(r)" />
                  </template>
                </template>
              </div>
            </div>
            <div v-if="expanded === r.product.id" :id="`rates-${r.product.id}`" class="grid gap-4 pt-8 md:grid-cols-2 lg:grid-cols-3">
              <MzRateOption
                v-for="o in r.options"
                :key="o.rate_plan?.id ?? 'default'"
                :option="o"
                currency="EUR"
                :nights="r.nights"
                :quantity="r.quantity"
                :urgency-threshold="search?.urgency_threshold ?? 0"
                :loading="selecting === `${r.product.id}-${o.rate_plan?.id}`"
                @select="choose(r, o)"
              />
            </div>
          </li>
        </ul>
      </template>

      <MzGrid v-else :cols="3" class="pt-4">
        <MzOfferCard
          v-for="c in cards"
          :key="c.id"
          :title="c.name"
          :product-id="c.id"
          :description="c.short_description ?? undefined"
          :image="c.cover?.url"
          :image-alt="c.cover?.alt ?? c.name"
          :to="localePath(`/stays/${c.slug}`)"
          :price-from-cents="c.from_price_minor"
          price-unit="night"
        />
      </MzGrid>
    </MzContainer>
  </div>
</template>
