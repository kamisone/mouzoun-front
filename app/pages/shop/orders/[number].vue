<script setup lang="ts">
import type { OrderItem, OrderView } from '~/utils/shop-types'

/**
 * Order page (signed link `?t=`, the order email, or the signed-in customer). Coming back from
 * Stripe (`?paid=1`) it polls the status until the webhook marked the order paid: the redirect
 * itself never changes anything. Tracking, pickup code, bank details, returns, invoice.
 */
definePageMeta({ i18n: { paths: { fr: '/boutique/orders/[number]', en: '/shop/orders/[number]', ar: '/boutique/orders/[number]' } } })

const { t } = useI18n()
const route = useRoute()
const api = useShopApi()
const shopPath = useShopPath()
const { money } = useMoney()
const { date, dateTime } = useDate()
const { data: config } = await useShopConfig()
useHead({ meta: [{ name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }] })

const number = String(route.params.number)
const token = computed(() => (route.query.t as string) || null)
const email = ref('')
const lookupEmail = ref<string | null>(null)
const order = ref<OrderView | null>(null)
const notFound = ref(false)
const loading = ref(true)

async function load() {
  try {
    order.value = await api.order(number, token.value, lookupEmail.value)
    notFound.value = false
  }
  catch {
    notFound.value = true
  }
  finally {
    loading.value = false
  }
}

const confirming = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
function poll() {
  if (!order.value || order.value.payment_method !== 'stripe' || order.value.payment_status === 'paid' || order.value.status === 'cancelled') return
  confirming.value = true
  let tries = 0
  timer = setInterval(async () => {
    tries += 1
    const s = await api.orderStatus(number, token.value).catch(() => null)
    if (s && (s.payment_status === 'paid' || s.status === 'cancelled' || tries > 40)) {
      clearInterval(timer)
      confirming.value = false
      await load()
    }
  }, 2000)
}
onMounted(async () => {
  await load()
  if (route.query.paid) poll()
})
onBeforeUnmount(() => clearInterval(timer))

async function lookup() {
  lookupEmail.value = email.value.trim()
  loading.value = true
  await load()
}

async function fake(outcome: 'paid' | 'failed') {
  await api.fakePayment(String(route.query.fake_session), outcome).catch(() => {})
  await load()
  poll()
}

// Return request.
const returning = ref(false)
// The 14-day withdrawal comes first (no reason needed); the others are claims (non-conformity).
const returnReason = ref('withdrawal')
const returnNote = ref('')
const returnQty = reactive<Record<string, number>>({})
/** Hygiene-sensitive goods: the withdrawal needs them still sealed. */
const sealed = reactive<Record<string, boolean>>({})
const withdrawing = computed(() => returnReason.value === 'withdrawal')
const returnItems = computed(() => (order.value?.items ?? []).filter(i => i.fulfilled_quantity > i.returned_quantity))
const excluded = (i: OrderItem) => withdrawing.value && (i.withdrawal_exemption === 'perishable' || i.withdrawal_exemption === 'personalised')
const returnDone = ref(false)
const returnError = ref<string | null>(null)
async function requestReturn() {
  const items = Object.entries(returnQty)
    .filter(([id, q]) => q > 0 && !excluded(returnItems.value.find(i => i.id === id)!))
    .map(([order_item_id, quantity]) => ({ order_item_id, quantity, still_sealed: sealed[order_item_id] ?? null }))
  if (!items.length) return
  try {
    await api.requestReturn(number, token.value, { items, reason: returnReason.value, note: returnNote.value || undefined })
    returnDone.value = true
    returning.value = false
    await load()
  }
  catch (e) {
    returnError.value = apiErrorMessage(e, t)
  }
}
const reasons = computed(() => ['withdrawal', 'non_conformity', 'damaged', 'wrong_item', 'other'].map(r => ({ value: r, label: t(`shop.order.returnRequest.reasons.${r}`) })))
const statusColor = (s: string) => (s === 'cancelled' ? 'error' : s === 'completed' ? 'success' : s === 'pending' ? 'warning' : 'info')
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-12 pt-24">
    <MzSkeleton v-if="loading" class="h-64" />
    <section v-else-if="notFound" class="mx-auto flex w-full max-w-md flex-col gap-4" aria-labelledby="lookup-title">
      <h1 id="lookup-title" class="font-display text-h2 text-highlighted">{{ t('shop.order.lookup.title') }}</h1>
      <p v-if="lookupEmail" class="text-small text-error" role="alert">{{ t('shop.order.lookup.notFound') }}</p>
      <form class="flex flex-col gap-3" @submit.prevent="lookup">
        <UFormField :label="t('shop.order.lookup.email')" name="email" required>
          <UInput v-model="email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UButton type="submit" :label="t('shop.order.lookup.submit')" />
      </form>
    </section>
    <template v-else-if="order">
      <header class="flex flex-col gap-2">
        <p v-if="route.query.paid || order.status !== 'pending'" class="text-body text-success">{{ t('shop.order.thanks') }}</p>
        <h1 class="font-display text-h1 text-highlighted">{{ t('shop.order.title', { number: order.number }) }}</h1>
        <div class="flex flex-wrap gap-2">
          <UBadge :color="statusColor(order.status)" variant="soft" :label="t(`shop.order.statuses.${order.status}`)" />
          <UBadge color="neutral" variant="soft" :label="t(`shop.order.payment.${order.payment_status}`)" data-testid="order-payment-status" />
          <UBadge color="neutral" variant="soft" :label="t(`shop.order.fulfillment.${order.fulfillment_status}`)" />
        </div>
      </header>

      <div v-if="confirming" class="flex items-center gap-3 rounded-md bg-elevated p-4" role="status" aria-live="polite" data-testid="order-confirming">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" aria-hidden="true" />
        <div><p class="font-medium">{{ t('shop.order.confirming') }}</p><p class="text-small text-muted">{{ t('shop.order.confirmingHint') }}</p></div>
      </div>
      <p v-if="route.query.cancelled && order.payment_status !== 'paid'" class="rounded-md bg-warning/10 p-4 text-body" role="alert">{{ t('shop.order.cancelledPayment') }}</p>

      <section v-if="config?.fake_payments && route.query.fake_session && order.payment_status !== 'paid'" class="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-default p-4">
        <p class="w-full text-small text-muted">{{ t('shop.order.fakePay.title') }}</p>
        <UButton :label="t('shop.order.fakePay.paid')" data-testid="fake-pay" @click="fake('paid')" />
        <UButton :label="t('shop.order.fakePay.failed')" color="neutral" variant="outline" @click="fake('failed')" />
      </section>

      <div class="grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div class="flex flex-col gap-8">
          <UButton v-if="order.payment_url" :to="order.payment_url" external :label="t('shop.order.payNow')" size="lg" class="self-start" />
          <section v-if="order.bank_transfer_details" class="rounded-md bg-elevated p-4">
            <h2 class="mb-2 font-medium text-highlighted">{{ t('shop.order.bankTransfer') }}</h2>
            <p class="whitespace-pre-line text-body">{{ order.bank_transfer_details }}</p>
            <p v-if="order.hold_until" class="mt-2 text-small text-muted">{{ t('shop.order.holdUntil', { date: date(order.hold_until) }) }}</p>
          </section>
          <p v-if="order.payment_method === 'cash_on_delivery' && order.payment_status !== 'paid'" class="text-body">
            {{ order.confirmed ? t('shop.order.cod', { amount: money(order.totals.total_minor, order.currency) }) : t('shop.order.codPending') }}
          </p>

          <section v-for="f in order.fulfillments" :key="f.id" class="flex flex-col gap-2 rounded-md border border-default p-4" data-testid="order-fulfillment">
            <p class="font-medium text-highlighted">{{ t(`shop.order.fulfillmentStatus.${f.status}`) }}</p>
            <p v-if="f.tracking_number" class="text-small">{{ t('shop.order.trackingNumber') }} : <span dir="ltr">{{ f.tracking_number }}</span><template v-if="f.carrier"> · {{ f.carrier }}</template></p>
            <UButton v-if="f.tracking_url" :to="f.tracking_url" external target="_blank" :label="t('shop.order.tracking')" icon="i-lucide-truck" color="neutral" variant="outline" class="self-start" />
            <div v-if="f.pickup_code" class="flex flex-col gap-1">
              <p class="text-small text-muted">{{ t('shop.order.pickupCode') }}</p>
              <p class="font-display text-h2 tracking-[0.3em] text-highlighted" dir="ltr" data-testid="pickup-code">{{ f.pickup_code }}</p>
              <p v-if="order.pickup_location" class="text-small text-muted">{{ t('shop.order.pickupHint', { place: order.pickup_location.name }) }}</p>
            </div>
          </section>

          <section aria-labelledby="items-title" class="flex flex-col gap-3">
            <h2 id="items-title" class="font-display text-h3 text-highlighted">{{ t('shop.order.items') }}</h2>
            <ul class="divide-y divide-default">
              <li v-for="i in order.items" :key="i.id" class="flex gap-4 py-3">
                <MzImage v-if="i.image_url" :src="i.image_url" :alt="i.name" ratio="1/1" class="w-16 shrink-0" sizes="xs:64px" />
                <div class="flex-1">
                  <p class="font-medium text-highlighted">{{ i.name }}</p>
                  <p class="text-small text-muted">{{ i.options_label }} · × {{ i.quantity }}</p>
                </div>
                <p class="tabular-nums">{{ money(i.total_minor, order.currency) }}</p>
              </li>
            </ul>
          </section>

          <section v-if="order.can_request_return || returnDone || order.returns.length" class="flex flex-col gap-3" aria-labelledby="return-title">
            <h2 id="return-title" class="font-display text-h3 text-highlighted">{{ t('shop.order.returnRequest.title') }}</h2>
            <p v-if="returnDone" class="text-body text-success" role="status">{{ t('shop.order.returnRequest.done') }}</p>
            <ul v-if="order.returns.length" class="text-small">
              <li v-for="r in order.returns" :key="r.id">{{ r.number }} · {{ t(`shop.order.returnRequest.reasons.${r.reason}`) }} · {{ r.status }}</li>
            </ul>
            <template v-if="order.can_request_return && !returnDone">
              <p v-if="order.return_until" class="text-small text-muted">{{ t('shop.order.returnRequest.until', { date: date(order.return_until) }) }}</p>
              <UButton v-if="!returning" :label="t('shop.order.returnRequest.title')" color="neutral" variant="outline" class="self-start" @click="returning = true" />
              <form v-else class="flex flex-col gap-3" @submit.prevent="requestReturn">
                <UFormField :label="t('shop.order.returnRequest.reason')" name="reason">
                  <USelect v-model="returnReason" :items="reasons" class="w-full" data-testid="return-reason" />
                </UFormField>
                <p v-if="withdrawing" class="text-small text-muted">{{ t('shop.order.returnRequest.withdrawalHint', { days: config?.refund_deadline_days ?? 14 }) }}</p>
                <div v-for="i in returnItems" :key="i.id" class="flex flex-col gap-2 border-b border-default pb-3">
                  <div class="flex items-center justify-between gap-3">
                    <span>{{ i.name }} <span class="text-muted">{{ i.options_label }}</span></span>
                    <UInputNumber v-model="returnQty[i.id]" :min="0" :max="i.fulfilled_quantity - i.returned_quantity" :disabled="excluded(i)" :aria-label="`${t('shop.order.returnRequest.quantity')} · ${i.name}`" class="w-28" />
                  </div>
                  <p v-if="excluded(i)" class="text-small text-muted">{{ t(`shop.product.withdrawal.${i.withdrawal_exemption}`) }}</p>
                  <UCheckbox v-else-if="withdrawing && i.withdrawal_exemption === 'unsealed_hygiene' && (returnQty[i.id] ?? 0) > 0" v-model="sealed[i.id]" :label="t('shop.order.returnRequest.sealed')" />
                </div>
                <UFormField :label="t('shop.order.returnRequest.note')" name="note">
                  <UTextarea v-model="returnNote" :rows="2" class="w-full" />
                </UFormField>
                <p v-if="returnError" class="text-small text-error" role="alert">{{ returnError }}</p>
                <UButton type="submit" :label="t('shop.order.returnRequest.submit')" class="self-start" />
              </form>
            </template>
          </section>
        </div>

        <aside class="flex flex-col gap-6 self-start rounded-md border border-default p-6">
          <MzCartSummary :cart="{ totals: order.totals, currency: order.currency, promotions: [] }" />
          <UButton v-if="order.invoice_number" :to="api.invoiceUrl(order.number, token)" external target="_blank" :label="t('shop.order.invoice')" icon="i-lucide-file-text" color="neutral" variant="outline" block />
          <section v-if="order.timeline.length" aria-labelledby="timeline-title">
            <h2 id="timeline-title" class="mb-2 font-medium text-highlighted">{{ t('shop.order.timeline') }}</h2>
            <ol class="flex flex-col gap-2 border-s border-default ps-4 text-small">
              <li v-for="(e, i) in order.timeline" :key="i">
                <p class="text-highlighted">{{ t(`shop.order.events.${e.kind}`) }}</p>
                <p class="text-muted">{{ dateTime(e.at) }}</p>
              </li>
            </ol>
          </section>
          <UButton :to="shopPath()" :label="t('shop.cart.continue')" color="neutral" variant="link" />
        </aside>
      </div>
    </template>
  </MzContainer>
</template>
