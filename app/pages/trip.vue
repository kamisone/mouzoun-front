<script setup lang="ts">
import type { CartItem, ProductCard, ProductPage, QuotedItem, Slot } from '~/utils/booking-types'

/**
 * "Your trip": the basket re-priced on every visit (with a clear notice when a price changed or
 * an item is no longer available), then "Complete your trip" on the same screen: extras of the
 * booked stays and activities with free departures during the stay, one tap to add, skippable.
 */
definePageMeta({ name: 'trip' })
const { t } = useI18n()
const localePath = useLocalePath()
const api = useBookingApi()
const trip = useTrip()
const toast = useToast()
const { money } = useMoney()
const { date, dateRange, dateTime } = useDate()
const { track } = useAnalytics()
const { data: config } = useBookingConfig()

useSeo({ title: () => `${t('booking.trip.title')} · ${t('common.siteName')}`, description: () => t('booking.trip.description') })
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })

await useAsyncData('trip-cart-load', () => trip.refresh())
const cart = trip.cart
const quote = computed(() => cart.value?.quote ?? null)

/** The quoted item (and its derived items) of each cart item. */
function quoted(index: number): QuotedItem | undefined {
  return quote.value?.items.find(q => q.request_index === index)
}
function derived(index: number): QuotedItem[] {
  const main = quoted(index)
  if (!main) return []
  return quote.value?.items.filter(q => q.parent_index === main.index && q.request_index == null) ?? []
}
const topLevel = computed(() => (cart.value?.items ?? []).map((item, index) => ({ item, index })).filter(x => !x.item.parent_id))
const childrenOf = (id: string) => (cart.value?.items ?? []).map((item, index) => ({ item, index })).filter(x => x.item.parent_id === id)

function when(q?: QuotedItem) {
  if (!q) return ''
  if (q.arrival && q.departure) return dateRange(q.arrival, q.departure)
  if (q.starts_at) return dateTime(q.starts_at)
  return q.date ? date(q.date) : ''
}
const guestCount = (q?: QuotedItem) => q?.guests.reduce((n, g) => n + g.count, 0) ?? 0
const issueText = (q?: QuotedItem) => (q?.issue ? t(`booking.issues.${q.issue.code}`, { ...(q.issue.details ?? {}) }, t('booking.issues.generic')) : '')

const busy = ref<string | null>(null)
async function remove(item: CartItem) {
  busy.value = item.id
  try {
    await trip.remove(item.id)
  }
  finally {
    busy.value = null
  }
}

// Promo code (collapsed link).
const promoOpen = ref(false)
const promo = ref('')
async function applyPromo() {
  busy.value = 'promo'
  try {
    await trip.setOptions({ promo_code: promo.value })
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}
async function removePromo() {
  promo.value = ''
  await trip.setOptions({ promo_code: '' })
}
const promoMessage = computed(() => {
  const p = quote.value?.promo
  if (!p) return null
  if (p.status === 'applied') return { tone: 'success', text: t('booking.promo.applied', { code: p.code }) }
  if (p.status === 'not_combinable') return { tone: 'warning', text: t('booking.promo.notCombinable') }
  return { tone: 'error', text: t(`booking.promo.reasons.${p.reason}`, t('booking.promo.reasons.generic')) }
})

// ---- Complete your trip ----------------------------------------------------------------------
const stays = computed(() => topLevel.value.filter(x => x.item.kind === 'stay').map(x => ({ ...x, q: quoted(x.index) })).filter(x => x.q && !x.q.issue))
const staySlugs = computed(() => [...new Set(stays.value.map(s => s.q!.slug).filter((s): s is string => !!s))])
const { data: stayPages } = await useAsyncData(
  () => `trip-stay-pages-${staySlugs.value.join(',')}`,
  async () => (await Promise.all(staySlugs.value.map(s => api.product(s).catch(() => null)))).filter((p): p is ProductPage => !!p),
  { default: () => [], watch: [staySlugs] },
)
const { data: activities } = await useAsyncData('trip-activities', () => api.products({ kind: 'activity' }).catch(() => [] as ProductCard[]), { default: () => [] })
const inCart = (productId: string) => (cart.value?.items ?? []).some(i => i.product_id === productId)
const extraOffers = computed(() => stays.value.flatMap((s) => {
  const page = stayPages.value.find(p => p.id === s.item.product_id)
  return (page?.extras ?? []).filter(e => !e.mandatory).map(e => ({ stay: s, extra: e }))
}))
const quantities = ref<Record<string, number>>({})
async function addExtra(offer: (typeof extraOffers.value)[number], day?: string) {
  const key = `${offer.stay.item.id}-${offer.extra.product_id}`
  busy.value = key
  try {
    await trip.add({
      kind: 'extra',
      product_id: offer.extra.product_id,
      parent_id: offer.stay.item.id,
      date: offer.extra.requires_date ? (day ?? offer.stay.q!.arrival) : null,
      quantity: quantities.value[key] ?? 1,
    })
    track('add_to_cart', { items: [{ item_id: offer.extra.product_id, item_name: offer.extra.name }] })
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}
const stayDays = (s: (typeof stays.value)[number]) => {
  const out: string[] = []
  for (let d = new Date(`${s.q!.arrival}T00:00:00Z`); d < new Date(`${s.q!.departure}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const next = new Date(d)
    next.setUTCDate(next.getUTCDate() + 1)
    out.push(next.toISOString().slice(0, 10))
  }
  return out
}

const slotFor = ref<ProductCard | null>(null)
const slotId = ref<string | null>(null)
const tripRange = computed(() => ({ from: quote.value?.starts_on ?? undefined, to: quote.value?.ends_on ?? undefined }))
const tripGuests = computed(() => stays.value[0]?.q?.guests ?? [])
async function addActivity(slot: Slot | null) {
  if (!slot || !slotFor.value) return
  busy.value = 'activity'
  try {
    await trip.add({ kind: 'activity', product_id: slotFor.value.id, slot_id: slot.id, guests: tripGuests.value })
    slotFor.value = null
    slotId.value = null
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

function proceed() {
  track('begin_checkout', { value: (quote.value?.total_minor ?? 0) / 100, currency: 'EUR' })
  return navigateTo(localePath('/checkout'))
}
</script>

<template>
  <MzContainer class="pt-12 pb-24 lg:pt-16">
    <header class="flex flex-col gap-3 pb-8">
      <p class="eyebrow">{{ t('booking.trip.eyebrow') }}</p>
      <h1 class="text-display-lg">{{ t('booking.trip.title') }}</h1>
    </header>

    <MzEmptyState
      v-if="!cart?.items.length"
      icon="i-lucide-tent"
      :title="t('booking.trip.empty')"
      :description="t('booking.trip.emptyText')"
    >
      <UButton :to="localePath('/stays')" :label="t('booking.trip.browse')" />
    </MzEmptyState>

    <div v-else class="grid gap-12 lg:grid-cols-12">
      <div class="flex flex-col gap-8 lg:col-span-7">
        <div v-if="cart.notices.length" class="flex flex-col gap-3" aria-live="polite">
          <UAlert
            v-for="n in cart.notices"
            :key="n.item_id + n.code"
            :color="n.code === 'unavailable' ? 'error' : 'warning'"
            variant="subtle"
            :icon="n.code === 'unavailable' ? 'i-lucide-circle-alert' : 'i-lucide-tag'"
            :title="n.code === 'unavailable'
              ? t('booking.trip.noticeUnavailable', { name: n.name })
              : t('booking.trip.noticePrice', { name: n.name, old: money(n.old_minor ?? 0), new: money(n.new_minor ?? 0) })"
            data-testid="trip-notice"
          />
        </div>

        <ul class="flex flex-col divide-y divide-default border-y border-default" data-testid="trip-items">
          <li v-for="{ item, index } in topLevel" :key="item.id" class="flex flex-col gap-3 py-6">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-h3">{{ quoted(index)?.name ?? t('booking.trip.item') }}</p>
                <p class="text-small text-muted">
                  {{ when(quoted(index)) }}<template v-if="guestCount(quoted(index))"> · {{ t('booking.search.guests', { n: guestCount(quoted(index)) }, guestCount(quoted(index))) }}</template>
                </p>
                <p v-if="quoted(index)?.issue" class="pt-2 text-small font-medium text-error">{{ issueText(quoted(index)) }}</p>
                <p v-else-if="quoted(index)?.on_request" class="pt-2 text-small text-warning">{{ t('booking.summary.onRequest') }}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-2">
                <span v-if="!quoted(index)?.issue" class="tabular-nums text-highlighted">{{ money(quoted(index)?.total_minor ?? 0) }}</span>
                <UButton
                  :label="t('booking.trip.remove')"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-trash-2"
                  :loading="busy === item.id"
                  @click="remove(item)"
                />
              </div>
            </div>
            <ul v-if="derived(index).length || childrenOf(item.id).length" class="flex flex-col gap-2 border-s border-default ps-4 text-small">
              <li v-for="d in derived(index)" :key="d.index" class="flex justify-between gap-3 text-muted">
                <span>{{ d.name }} · {{ d.in_package ? t('booking.trip.inPackage') : t('booking.summary.included') }}</span>
                <span class="tabular-nums">{{ d.total_minor ? money(d.total_minor) : '' }}</span>
              </li>
              <li v-for="c in childrenOf(item.id)" :key="c.item.id" class="flex items-center justify-between gap-3">
                <span>{{ quoted(c.index)?.name }}<template v-if="quoted(c.index)?.quantity && quoted(c.index)!.quantity > 1"> × {{ quoted(c.index)!.quantity }}</template><template v-if="quoted(c.index)?.date"> · {{ date(quoted(c.index)!.date!, 'medium') }}</template></span>
                <span class="flex items-center gap-2">
                  <span class="tabular-nums">{{ money(quoted(c.index)?.total_minor ?? 0) }}</span>
                  <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('booking.trip.removeNamed', { name: quoted(c.index)?.name })" @click="remove(c.item)" />
                </span>
              </li>
            </ul>
          </li>
        </ul>

        <div>
          <button v-if="!promoOpen && quote?.promo?.status !== 'applied'" type="button" class="link-underline text-small font-medium text-highlighted" @click="promoOpen = true">
            {{ t('booking.promo.have') }}
          </button>
          <form v-else-if="quote?.promo?.status !== 'applied'" class="flex max-w-md gap-2" @submit.prevent="applyPromo">
            <UInput v-model="promo" :placeholder="t('booking.promo.placeholder')" :aria-label="t('booking.promo.label')" class="flex-1" autocomplete="off" />
            <UButton type="submit" :label="t('booking.promo.apply')" color="neutral" variant="outline" :loading="busy === 'promo'" />
          </form>
          <p v-if="promoMessage" class="pt-2 text-small" :class="{ success: 'text-success', warning: 'text-warning', error: 'text-error' }[promoMessage.tone]" role="status">
            {{ promoMessage.text }}
            <button v-if="quote?.promo" type="button" class="link-underline ms-2 text-muted" @click="removePromo">{{ t('booking.promo.remove') }}</button>
          </p>
        </div>

        <!-- Complete your trip -->
        <section v-if="extraOffers.length || (stays.length && activities.length)" class="flex flex-col gap-6 pt-8" data-testid="upsell">
          <header>
            <h2 class="text-h2">{{ t('booking.upsell.title') }}</h2>
            <p class="text-muted">{{ t('booking.upsell.text') }}</p>
          </header>
          <ul v-if="extraOffers.length" class="grid gap-4 sm:grid-cols-2">
            <li v-for="o in extraOffers" :key="`${o.stay.item.id}-${o.extra.product_id}`" class="flex flex-col gap-3 rounded-sm border border-default p-4">
              <div>
                <p class="font-medium text-highlighted">{{ o.extra.name }}</p>
                <p v-if="o.extra.description" class="text-small text-muted">{{ o.extra.description }}</p>
                <p v-if="o.extra.price_minor" class="pt-1 text-small text-highlighted">
                  {{ money(o.extra.price_minor) }} <span class="text-muted">{{ t(`booking.units.${o.extra.price_unit}`, '') }}</span>
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <USelect
                  v-if="o.extra.requires_date"
                  :items="stayDays(o.stay).map(d => ({ label: date(d, 'medium'), value: d }))"
                  :default-value="stayDays(o.stay)[0]"
                  :aria-label="t('booking.upsell.date')"
                  class="w-40"
                  @update:model-value="(d: unknown) => addExtra(o, String(d))"
                />
                <UButton
                  :label="inCart(o.extra.product_id) ? t('booking.upsell.addAnother') : t('booking.upsell.add')"
                  icon="i-lucide-plus"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="busy === `${o.stay.item.id}-${o.extra.product_id}`"
                  @click="addExtra(o)"
                />
              </div>
            </li>
          </ul>
          <ul v-if="stays.length && activities.length" class="grid gap-4 sm:grid-cols-2">
            <li v-for="a in activities.filter(x => !inCart(x.id)).slice(0, 4)" :key="a.id" class="flex items-center justify-between gap-4 rounded-sm border border-default p-4">
              <div class="min-w-0">
                <p class="font-medium text-highlighted">{{ a.name }}</p>
                <MzPrice v-if="a.from_price_minor" :cents="a.from_price_minor" from unit="person" size="sm" />
              </div>
              <UButton :label="t('booking.upsell.chooseTime')" size="sm" color="neutral" variant="outline" @click="slotFor = a" />
            </li>
          </ul>
        </section>

        <div class="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
          <UButton
            :label="extraOffers.length ? t('booking.upsell.continueWithout') : t('booking.trip.checkout')"
            size="xl"
            :disabled="!quote || quote.has_issues || config?.enabled === false"
            data-testid="trip-continue"
            @click="proceed"
          />
          <p v-if="quote?.has_issues" class="text-small text-error">{{ t('booking.trip.fixIssues') }}</p>
        </div>
      </div>

      <div class="lg:col-span-5">
        <div class="sticky top-24">
          <MzTripSummary v-if="quote && !quote.has_issues" :quote="quote" />
        </div>
      </div>
    </div>

    <UModal
      :open="!!slotFor"
      :title="slotFor?.name ?? ''"
      :description="t('booking.upsell.slotsDuringStay')"
      @update:open="(v: boolean) => { if (!v) slotFor = null }"
    >
      <template #body>
        <MzSlotPicker
          v-if="slotFor"
          v-model="slotId"
          :product-id="slotFor.id"
          :from="tripRange.from"
          :to="tripRange.to"
          :participants="tripGuests.reduce((n, g) => n + g.count, 0)"
          @selected="addActivity"
        />
      </template>
    </UModal>
  </MzContainer>
</template>
