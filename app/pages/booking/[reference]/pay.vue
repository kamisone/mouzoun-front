<script setup lang="ts">
import type { BookingConfig, BookingView, StartedPayment, TripItem } from '~/utils/booking-types'

/**
 * Payment step: the inventory is held (calm countdown), Stripe's Payment Element (or the fake
 * provider in development), the amount and what it confirms. On a decline the guest stays here
 * and can retry; when the hold runs out the trip can be tried again with the same items.
 */
definePageMeta({ layout: 'default' })
const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const api = useBookingApi()
const access = useBookingAccess()
const trip = useTrip()
const { money } = useMoney()
useHead({ title: () => t('booking.pay.title'), meta: [{ name: 'robots', content: 'noindex' }] })

const reference = computed(() => String(route.params.reference))
const token = ref<string | null>(typeof route.query.t === 'string' ? route.query.t : null)
const booking = ref<BookingView | null>(null)
const payment = ref<StartedPayment | null>(null)
const config = ref<BookingConfig['payments']>({})
const failed = ref<string | null>(null)
const expired = ref(false)
const loading = ref(true)

onMounted(async () => {
  token.value ||= access.get(reference.value)
  // Signed in: the account opens its own bookings without the email token.
  if (!token.value && await useAccount().load()) token.value = ''
  if (token.value === null) {
    loading.value = false
    return
  }
  if (token.value) access.remember(reference.value, token.value)
  try {
    booking.value = await api.booking.get(reference.value, token.value)
    if (booking.value.status !== 'awaiting_payment' && !(booking.value.status === 'confirmed' && booking.value.totals.balance_minor > 0)) {
      await navigateTo({ path: localePath(`/booking/${reference.value}`), query: { t: token.value } })
      return
    }
    const saved = JSON.parse(sessionStorage.getItem(`mz-payment-${reference.value}`) ?? 'null') as { payment: StartedPayment, config: BookingConfig['payments'] } | null
    if (saved && booking.value.status === 'awaiting_payment') {
      payment.value = saved.payment
      config.value = saved.config
    }
    else {
      const res = await api.booking.pay(reference.value, token.value)
      payment.value = res.payment
      config.value = res.payment_config
    }
  }
  catch (e) {
    failed.value = t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic'))
  }
  finally {
    loading.value = false
  }
})

const returnUrl = computed(() => (import.meta.client ? `${window.location.origin}${localePath(`/booking/${reference.value}`)}?t=${encodeURIComponent(token.value ?? '')}&paid=1` : ''))
async function paid() {
  sessionStorage.removeItem(`mz-payment-${reference.value}`)
  await navigateTo({ path: localePath(`/booking/${reference.value}`), query: { t: token.value, paid: '1' } })
}

/** The hold ran out: put the same items back in the basket and go back to checkout. */
const retrying = ref(false)
async function tryAgain() {
  retrying.value = true
  try {
    const saved = JSON.parse(sessionStorage.getItem('mz-last-basket') ?? '[]') as (TripItem & { id: string, parent_id: string | null })[]
    const ids = new Map<string, string>()
    for (const item of saved) {
      const { id, parent_id: parent, ...rest } = item
      const view = await trip.add({ ...(rest as TripItem), parent_id: parent ? ids.get(parent) ?? null : null })
      if (view.added_id) ids.set(id, view.added_id)
    }
    await navigateTo(localePath('/checkout'))
  }
  catch {
    await navigateTo(localePath('/trip'))
  }
  finally {
    retrying.value = false
  }
}
const amount = computed(() => payment.value?.amount_minor ?? 0)
const isBalance = computed(() => booking.value?.status === 'confirmed')
</script>

<template>
  <MzContainer size="narrow" class="pt-12 pb-24 lg:pt-16">
    <header class="flex flex-col gap-3 pb-8">
      <p class="eyebrow">{{ t('booking.pay.eyebrow', { reference }) }}</p>
      <h1 class="text-display-lg">{{ isBalance ? t('booking.pay.balanceTitle') : t('booking.pay.title') }}</h1>
    </header>
    <MzSkeleton v-if="loading" variant="card" />
    <MzEmptyState v-else-if="token === null" icon="i-lucide-link" :title="t('booking.manage.noAccess')" :description="t('booking.manage.noAccessText')">
      <UButton :to="localePath('/booking/find')" :label="t('booking.find.title')" />
    </MzEmptyState>
    <div v-else-if="expired" class="flex flex-col gap-4" role="alert">
      <p class="text-h3">{{ t('booking.pay.expired') }}</p>
      <p class="text-muted">{{ t('booking.pay.expiredText') }}</p>
      <UButton :label="t('booking.pay.tryAgain')" :loading="retrying" size="lg" class="self-start" @click="tryAgain" />
    </div>
    <div v-else-if="booking && payment" class="grid gap-8 md:grid-cols-5">
      <div class="flex flex-col gap-6 md:col-span-3">
        <MzHoldCountdown v-if="booking.hold_expires_at && !isBalance" :until="booking.hold_expires_at" @expired="expired = true" />
        <p class="text-body-lg">
          {{ isBalance ? t('booking.pay.balanceText', { amount: money(amount, booking.currency) }) : t('booking.pay.text', { amount: money(amount, booking.currency) }) }}
        </p>
        <MzPaymentForm
          :payment="payment"
          :config="config"
          :return-url="returnUrl"
          :cta="t('booking.pay.cta', { amount: money(amount, booking.currency) })"
          @paid="paid"
        />
      </div>
      <aside class="flex flex-col gap-3 rounded-sm bg-muted p-6 text-small md:col-span-2">
        <p class="eyebrow">{{ t('booking.summary.title') }}</p>
        <p v-for="i in booking.items.filter(x => !x.parent_id && x.status === 'active')" :key="i.id" class="text-highlighted">{{ i.name }}</p>
        <p class="flex justify-between border-t border-default pt-3"><span>{{ t('booking.price.total') }}</span><span class="tabular-nums">{{ money(booking.totals.total_minor, booking.currency) }}</span></p>
        <p class="flex justify-between font-medium text-highlighted"><span>{{ t('booking.summary.dueToday') }}</span><span class="tabular-nums">{{ money(amount, booking.currency) }}</span></p>
      </aside>
    </div>
    <p v-else-if="failed" role="alert" class="text-error">{{ failed }}</p>
  </MzContainer>
</template>
