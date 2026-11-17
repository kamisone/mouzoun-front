<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * Order detail, laid out like Shopify: lines and fulfilments on the left; customer, addresses,
 * payment, tags and risk on the right; the timeline with a comment box at the bottom.
 * Actions show only with the permission; destructive ones confirm with their amount and the
 * stock effect.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.orders' })

const { t } = useI18n()
const route = useRoute()
const admin = useAdminApi()
const { money } = useMoney()
const { dateTime } = useDate()
const { can, act, statusColor } = useShopAdmin()
const id = String(route.params.id)
const { data: order, refresh } = await useAsyncData(`admin-shop-order-${id}`, () => admin.shop.orders.get(id))
const o = computed(() => order.value as Json)
const cur = computed(() => o.value?.currency ?? 'EUR')
async function run<T>(fn: () => Promise<T>, success?: string) {
  const out = await act(fn, success)
  if (out !== undefined) order.value = (out as Json)?.id ? out as Json : order.value
  await refresh()
  return out
}

// Fulfilment: quantities per line (default: what is left).
const toFulfil = reactive<Record<string, number>>({})
watchEffect(() => {
  for (const i of o.value?.items ?? []) if (toFulfil[i.id] === undefined) toFulfil[i.id] = i.quantity - i.fulfilled_quantity
})
const fulfillable = computed(() => o.value?.status === 'open' && (o.value?.items ?? []).some((i: Json) => i.quantity > i.fulfilled_quantity))
function fulfil() {
  const items = Object.entries(toFulfil).filter(([, q]) => q > 0).map(([order_item_id, quantity]) => ({ order_item_id, quantity }))
  return run(() => admin.shop.orders.fulfill(id, { items }), t('admin.shop.orders.fulfilled'))
}
const ship = reactive<Record<string, { carrier: string, tracking_number: string, tracking_url: string, code: string }>>({})
const shipOf = (fid: string) => (ship[fid] ??= { carrier: '', tracking_number: '', tracking_url: '', code: '' })
function step(fid: string, action: string, extra: Json = {}) {
  return run(() => admin.shop.orders.fulfillment(fid, { action, ...extra }))
}

// Payment, refund, cancel.
const payment = ref({ provider: 'cash', amount: 0, reference: '' })
watchEffect(() => { if (o.value) payment.value.amount = (o.value.totals.total_minor - o.value.amount_paid_minor) / 100 })
const refund = ref({ amount: 0, shipping: false, restock: false, reason: '', lines: {} as Record<string, number> })
const refundTotal = computed(() => {
  const lines = (o.value?.items ?? []).reduce((a: number, i: Json) => a + Math.round(i.total_minor * (refund.value.lines[i.id] ?? 0) / i.quantity), 0)
  const shipping = refund.value.shipping ? (o.value?.totals.shipping_minor ?? 0) - (o.value?.totals.shipping_discount_minor ?? 0) : 0
  return refund.value.amount > 0 ? Math.round(refund.value.amount * 100) : lines + shipping
})
const confirmRefund = ref(false)
function recordPayment() {
  return run(() => admin.shop.orders.recordPayment(id, { provider: payment.value.provider, amount_minor: Math.round(payment.value.amount * 100), reference: payment.value.reference || undefined }), t('admin.shop.orders.paymentRecorded'))
}
function doRefund() {
  const items = Object.entries(refund.value.lines).filter(([, q]) => q > 0).map(([order_item_id, quantity]) => ({ order_item_id, quantity }))
  const shipping = refund.value.shipping ? (o.value.totals.shipping_minor - o.value.totals.shipping_discount_minor) : 0
  return run(() => admin.shop.orders.refund(id, refund.value.amount > 0
    ? { amount_minor: Math.round(refund.value.amount * 100), reason: refund.value.reason || undefined }
    : { items, shipping_minor: shipping, restock: refund.value.restock, reason: refund.value.reason || undefined }), t('admin.shop.orders.refunded')).finally(() => { confirmRefund.value = false })
}
const cancelOpen = ref(false)
const cancelForm = ref({ reason: 'customer', restock: true, refund: true, message: '' })
const restockUnits = computed(() => (o.value?.items ?? []).reduce((a: number, i: Json) => a + i.quantity, 0))
function cancel() {
  return run(() => admin.shop.orders.cancel(id, { ...cancelForm.value, message: cancelForm.value.message || undefined }), t('admin.shop.orders.cancelled')).finally(() => { cancelOpen.value = false })
}

// Edit lines (drafts, unpaid offline, COD).
const editOpen = ref(false)
const editLines = ref<{ variant_id: string, name: string, quantity: number }[]>([])
const addSku = ref('')
function openEdit() {
  editLines.value = (o.value.items as Json[]).map(i => ({ variant_id: i.variant_id, name: `${i.snapshot.name} ${i.snapshot.options_label ?? ''}`, quantity: i.quantity }))
  editOpen.value = true
}
const { data: variantChoices } = await useLazyAsyncData('admin-shop-variant-choices', () => admin.shop.inventory.grid({ per_page: 100 }), { server: false })
function addLine() {
  const v = (variantChoices.value?.data ?? []).find((x: Json) => x.variant_id === addSku.value)
  if (v && !editLines.value.some(l => l.variant_id === v.variant_id)) editLines.value.push({ variant_id: v.variant_id, name: `${v.name} ${v.options}`, quantity: 1 })
}
function saveEdit() {
  return run(() => admin.shop.orders.edit(id, { lines: editLines.value.filter(l => l.quantity > 0).map(l => ({ variant_id: l.variant_id, quantity: l.quantity })) }), t('admin.shop.orders.edited')).finally(() => { editOpen.value = false })
}
const editable = computed(() => o.value && (o.value.status === 'draft' || (['pending', 'open'].includes(o.value.status) && o.value.amount_paid_minor === 0 && o.value.payment_method !== 'stripe' && o.value.fulfillment_status === 'unfulfilled')))

// Notes, tags, risk.
const comment = ref('')
const tags = ref('')
watchEffect(() => { tags.value = (o.value?.tags ?? []).join(', ') })
function saveTags() {
  return run(() => admin.shop.orders.annotate(id, { tags: tags.value.split(',').map(x => x.trim()).filter(Boolean) }))
}
function setRisk(v: string) {
  return run(() => admin.shop.orders.annotate(id, { risk_level: v }))
}
function addComment() {
  if (!comment.value.trim()) return
  return run(() => admin.shop.orders.annotate(id, { message: comment.value })).then(() => { comment.value = '' })
}
const resendTemplates = ['order_confirmation', 'order_payment_pending', 'order_confirmed_cod', 'order_shipped', 'order_ready_for_pickup', 'order_delivered', 'order_cancelled', 'refund_issued']
const returnAction = (rid: string, action: string, items?: Json[]) => run(() => admin.shop.returns.update(rid, { action, ...(items ? { items } : {}) }))
const carriers = ['amana', 'ctm', 'dhl']
</script>

<template>
  <div v-if="o" class="flex flex-col gap-6">
    <MzPageHeader :title="o.number" :description="o.placed_at ? dateTime(o.placed_at) : t('shop.order.statuses.draft')" :breadcrumbs="[{ label: t('admin.shop.nav.orders'), to: '/admin/shop/orders' }, { label: o.number }]">
      <template #actions>
        <UButton v-if="o.requires_confirmation && !o.confirmed && o.status === 'pending' && can('shop.orders')" :label="t('admin.shop.orders.confirmCod')" icon="i-lucide-phone-call" @click="run(() => admin.shop.orders.confirm(id), t('admin.shop.orders.confirmed'))" />
        <UButton v-if="editable && can('shop.orders')" :label="t('admin.shop.orders.edit')" icon="i-lucide-pencil" color="neutral" variant="outline" @click="openEdit" />
        <UButton v-if="o.invoices?.length" :to="admin.url(admin.shop.orders.invoicePath(id))" external target="_blank" :label="t('admin.shop.orders.invoice')" icon="i-lucide-file-text" color="neutral" variant="outline" />
        <UDropdownMenu v-if="can('shop.orders') && o.status !== 'draft'" :items="resendTemplates.map(tpl => ({ label: t(`admin.shop.templates.${tpl}`), onSelect: () => run(() => admin.shop.orders.resend(id, tpl), t('admin.shop.orders.resent')) }))">
          <UButton :label="t('admin.shop.orders.resend')" icon="i-lucide-mail" color="neutral" variant="outline" />
        </UDropdownMenu>
        <UButton v-if="!['cancelled', 'completed', 'draft'].includes(o.status) && can('shop.orders')" :label="t('admin.shop.orders.cancel')" icon="i-lucide-ban" color="error" variant="soft" @click="cancelOpen = true" />
      </template>
    </MzPageHeader>
    <div class="flex flex-wrap gap-2">
      <UBadge :color="statusColor(o.status)" variant="soft" :label="t(`shop.order.statuses.${o.status}`)" />
      <UBadge :color="statusColor(o.payment_status)" variant="soft" :label="t(`shop.order.payment.${o.payment_status}`)" />
      <UBadge color="neutral" variant="soft" :label="t(`shop.order.fulfillment.${o.fulfillment_status}`)" />
      <UBadge color="neutral" variant="outline" :label="t(`admin.shop.channels.${o.channel}`)" />
      <UBadge v-if="o.risk_level !== 'normal'" color="error" variant="solid" :label="t(`admin.shop.risk.${o.risk_level}`)" />
    </div>

    <UCard v-if="o.status === 'draft' && can('shop.orders')" data-testid="draft-finalize">
      <template #header><h2 class="font-medium">{{ t('admin.shop.drafts.finalize') }}</h2></template>
      <p class="mb-3 text-small text-muted">{{ t('admin.shop.drafts.finalizeHint') }}</p>
      <div class="flex flex-wrap gap-2">
        <UButton :label="t('admin.shop.drafts.paymentLink')" icon="i-lucide-link" @click="run(() => admin.shop.orders.finalize(id, { mode: 'payment_link' }), t('admin.shop.drafts.linkSent'))" />
        <UButton :label="t('admin.shop.drafts.paidCash')" icon="i-lucide-banknote" color="neutral" variant="outline" @click="run(() => admin.shop.orders.finalize(id, { mode: 'pay_at_pickup', paid: true, provider: 'cash' }))" />
        <UButton :label="t('shop.checkout.payment.cash_on_delivery')" color="neutral" variant="outline" @click="run(() => admin.shop.orders.finalize(id, { mode: 'cash_on_delivery' }))" />
        <UButton :label="t('shop.checkout.payment.bank_transfer')" color="neutral" variant="outline" @click="run(() => admin.shop.orders.finalize(id, { mode: 'bank_transfer' }))" />
        <UButton :label="t('shop.checkout.payment.pay_at_pickup')" color="neutral" variant="outline" @click="run(() => admin.shop.orders.finalize(id, { mode: 'pay_at_pickup' }))" />
        <UButton :label="t('common.delete')" color="error" variant="ghost" @click="act(() => admin.shop.orders.deleteDraft(id)).then(() => navigateTo('/admin/shop/orders'))" />
      </div>
    </UCard>

    <div class="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div class="flex flex-col gap-6">
        <UCard>
          <template #header><h2 class="font-medium">{{ t('shop.order.items') }}</h2></template>
          <table class="w-full text-body">
            <tbody>
              <tr v-for="i in o.items" :key="i.id" class="border-b border-default last:border-0">
                <td class="py-2">
                  <p class="font-medium text-highlighted">{{ i.snapshot.name }}</p>
                  <p class="text-small text-muted">{{ i.snapshot.options_label }} · {{ i.sku }}<template v-if="i.reserved"> · {{ t('admin.shop.orders.reserved', { n: i.reserved }) }}</template></p>
                  <p class="text-small text-muted">{{ t('admin.shop.orders.lineProgress', { f: i.fulfilled_quantity, r: i.returned_quantity, rf: i.refunded_quantity }) }}</p>
                </td>
                <td class="py-2 text-end tabular-nums">{{ money(i.unit_price_minor, cur) }} × {{ i.quantity }}</td>
                <td class="py-2 text-end tabular-nums">{{ money(i.total_minor, cur) }}</td>
                <td v-if="fulfillable && can('shop.orders')" class="w-24 py-2 ps-3">
                  <UInputNumber v-model="toFulfil[i.id]" :min="0" :max="i.quantity - i.fulfilled_quantity" size="sm" :aria-label="t('admin.shop.orders.toFulfil', { name: i.snapshot.name })" />
                </td>
              </tr>
            </tbody>
          </table>
          <template v-if="fulfillable && can('shop.orders')" #footer>
            <UButton :label="t('admin.shop.orders.createFulfillment')" icon="i-lucide-package-check" @click="fulfil" />
          </template>
        </UCard>

        <UCard v-for="f in o.fulfillments" :key="f.id">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-medium">{{ t(`shop.checkout.fulfillment.${f.method}`) }} · {{ f.location }}</h2>
              <UBadge :color="statusColor(f.status)" variant="soft" :label="t(`shop.order.fulfillmentStatus.${f.status}`)" />
            </div>
          </template>
          <ul class="text-small">
            <li v-for="it in f.items" :key="it.order_item_id">
              {{ o.items.find((i: Json) => i.id === it.order_item_id)?.snapshot.name }} × {{ it.quantity }}
              <span v-for="l in it.lots" :key="l.lot_id" class="text-muted"> · {{ t('admin.shop.inventory.lot') }} {{ l.lot_code }} ({{ l.best_before }}) ×{{ l.quantity }}</span>
            </li>
          </ul>
          <p v-if="f.tracking_number" class="mt-2 text-small">{{ f.carrier }} · <a v-if="f.tracking_url" :href="f.tracking_url" target="_blank" rel="noopener" class="underline">{{ f.tracking_number }}</a><span v-else>{{ f.tracking_number }}</span></p>
          <template v-if="can('shop.orders') && !['delivered', 'picked_up', 'failed', 'cancelled'].includes(f.status)" #footer>
            <div class="flex flex-wrap items-end gap-2">
              <UButton :to="admin.url(admin.shop.orders.packingSlipPath(f.id))" external target="_blank" :label="t('admin.shop.orders.packingSlip')" icon="i-lucide-printer" color="neutral" variant="outline" size="sm" />
              <UButton v-if="f.status === 'pending'" :label="t('shop.order.fulfillmentStatus.packed')" size="sm" color="neutral" variant="outline" @click="step(f.id, 'pack')" />
              <template v-if="f.method === 'pickup'">
                <UButton v-if="f.status !== 'ready_for_pickup'" :label="t('admin.shop.orders.markReady')" size="sm" @click="step(f.id, 'ready_for_pickup')" />
                <UInput v-model="shipOf(f.id).code" :placeholder="t('shop.order.pickupCode')" :aria-label="t('shop.order.pickupCode')" size="sm" class="w-32" inputmode="numeric" dir="ltr" />
                <UButton :label="o.amount_paid_minor < o.totals.total_minor ? t('admin.shop.orders.pickUpAndCollect', { amount: money(o.totals.total_minor - o.amount_paid_minor, cur) }) : t('admin.shop.orders.pickUp')" size="sm" @click="step(f.id, 'pick_up', { code: shipOf(f.id).code, collect_payment: true })" />
              </template>
              <template v-else-if="f.method === 'shipping'">
                <USelect v-model="shipOf(f.id).carrier" :items="carriers" :placeholder="t('admin.shop.orders.carrier')" size="sm" class="w-28" />
                <UInput v-model="shipOf(f.id).tracking_number" :placeholder="t('shop.order.trackingNumber')" size="sm" class="w-40" dir="ltr" />
                <UInput v-model="shipOf(f.id).tracking_url" placeholder="https://" size="sm" class="w-48" dir="ltr" />
                <UButton v-if="!['shipped', 'in_transit'].includes(f.status)" :label="t('admin.shop.orders.markShipped')" size="sm" @click="step(f.id, 'ship', { carrier: shipOf(f.id).carrier || undefined, tracking_number: shipOf(f.id).tracking_number || undefined, tracking_url: shipOf(f.id).tracking_url || undefined })" />
                <UButton v-else :label="t('admin.shop.orders.markDelivered')" size="sm" @click="step(f.id, 'deliver')" />
              </template>
              <template v-else>
                <UButton :label="t('admin.shop.orders.markDelivered')" size="sm" @click="step(f.id, 'deliver')" />
              </template>
              <UButton :label="t('admin.shop.orders.cancelFulfillment')" size="sm" color="neutral" variant="ghost" @click="step(f.id, 'cancel')" />
            </div>
          </template>
        </UCard>

        <UCard v-for="r in o.returns" :key="r.id">
          <template #header>
            <div class="flex items-center justify-between"><h2 class="font-medium">{{ t('admin.shop.returns.return') }} {{ r.number }} · {{ t(`shop.order.returnRequest.reasons.${r.reason}`) }}</h2><UBadge :color="statusColor(r.status)" variant="soft" :label="t(`admin.shop.returns.statuses.${r.status}`)" /></div>
          </template>
          <p v-if="r.customer_note" class="text-small">“{{ r.customer_note }}”</p>
          <ul class="text-small">
            <li v-for="it in r.items" :key="it.order_item_id">{{ o.items.find((i: Json) => i.id === it.order_item_id)?.snapshot.name }} × {{ it.quantity }}</li>
          </ul>
          <template v-if="can('shop.refunds') && !['closed', 'rejected'].includes(r.status)" #footer>
            <div class="flex flex-wrap gap-2">
              <UButton v-if="r.status === 'requested'" :label="t('admin.shop.returns.approve')" size="sm" @click="returnAction(r.id, 'approve')" />
              <UButton v-if="['requested', 'approved'].includes(r.status)" :label="t('admin.shop.returns.reject')" size="sm" color="neutral" variant="outline" @click="returnAction(r.id, 'reject')" />
              <UButton v-if="['requested', 'approved'].includes(r.status)" :label="t('admin.shop.returns.receiveRestock')" size="sm" color="neutral" variant="outline" @click="returnAction(r.id, 'receive', r.items.map((i: Json) => ({ order_item_id: i.order_item_id, restock: true, condition: 'sellable' })))" />
              <UButton v-if="['requested', 'approved'].includes(r.status)" :label="t('admin.shop.returns.receiveDamaged')" size="sm" color="neutral" variant="ghost" @click="returnAction(r.id, 'receive', r.items.map((i: Json) => ({ order_item_id: i.order_item_id, restock: false, condition: 'damaged' })))" />
              <UButton v-if="r.status === 'received'" :label="t('admin.shop.returns.close')" size="sm" color="neutral" variant="ghost" @click="returnAction(r.id, 'close')" />
            </div>
          </template>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium">{{ t('shop.order.timeline') }}</h2></template>
          <form class="mb-4 flex gap-2" @submit.prevent="addComment">
            <UInput v-model="comment" :placeholder="t('admin.shop.orders.comment')" :aria-label="t('admin.shop.orders.comment')" class="flex-1" />
            <UButton type="submit" :label="t('admin.shop.orders.post')" color="neutral" variant="outline" />
          </form>
          <ol class="flex flex-col gap-3 border-s border-default ps-4" data-testid="admin-timeline">
            <li v-for="e in o.timeline" :key="e.id" class="text-small">
              <p class="text-highlighted">{{ t(`admin.shop.events.${e.kind}`, e.kind) }}<template v-if="e.to"> · {{ e.from }} → {{ e.to }}</template></p>
              <p v-if="e.message" class="text-body">{{ e.message }}</p>
              <p class="text-muted">{{ dateTime(e.at) }} · {{ e.user ?? t(`admin.shop.actors.${e.actor_type}`) }}</p>
            </li>
          </ol>
        </UCard>
      </div>

      <div class="flex flex-col gap-6">
        <UCard>
          <template #header><h2 class="font-medium">{{ t('admin.shop.orders.customer') }}</h2></template>
          <p class="font-medium text-highlighted"><NuxtLink :to="`/admin/customers/${o.customer.id}`" class="hover:underline">{{ o.customer.first_name }} {{ o.customer.last_name }}</NuxtLink></p>
          <p class="text-small">{{ o.email }}</p>
          <p v-if="o.phone" class="text-small" dir="ltr">{{ o.phone }}</p>
          <p class="text-small text-muted">{{ t('admin.shop.orders.customerOrders', { n: o.customer.orders_count }) }}</p>
          <p v-if="o.customer_note" class="mt-2 rounded bg-elevated p-2 text-small">“{{ o.customer_note }}”</p>
        </UCard>
        <UCard>
          <template #header><h2 class="font-medium">{{ t(`shop.checkout.fulfillment.${o.fulfillment_method}`) }}</h2></template>
          <p v-if="o.shipping_address" class="text-small">{{ o.shipping_address.first_name }} {{ o.shipping_address.last_name }}<br>{{ o.shipping_address.line1 }}<br><template v-if="o.shipping_address.line2">{{ o.shipping_address.line2 }}<br></template>{{ o.shipping_address.postal_code }} {{ o.shipping_address.city }} · {{ o.shipping_address.country_code }}<br><span dir="ltr">{{ o.shipping_address.phone }}</span></p>
          <p v-if="o.pickup_location" class="text-small">{{ o.pickup_location.name }}</p>
          <p v-if="o.booking_reference" class="text-small">{{ t('shop.checkout.fulfillment.bookingReference') }} : {{ o.booking_reference }}</p>
          <p v-for="l in o.shipping_lines" :key="l.code" class="text-small text-muted">{{ l.name }} · {{ money(l.amount_minor - l.discount_minor, cur) }}</p>
        </UCard>
        <UCard>
          <template #header><h2 class="font-medium">{{ t('admin.shop.orders.payment') }}</h2></template>
          <MzCartSummary :cart="{ totals: o.totals, currency: cur, promotions: [] }" />
          <p class="mt-2 text-small">{{ t('admin.shop.orders.paidRefunded', { paid: money(o.amount_paid_minor, cur), refunded: money(o.amount_refunded_minor, cur) }) }}</p>
          <ul class="mt-2 flex flex-col gap-1 text-small">
            <li v-for="p in o.payments" :key="p.id">{{ t(`admin.shop.providers.${p.provider}`, p.provider) }} · {{ money(p.amount_minor, cur) }} · {{ p.status }}<template v-if="p.received_by"> · {{ p.received_by }}</template>
              <ul class="ms-3 text-muted"><li v-for="r in p.refunds" :key="r.id">↩ {{ money(r.amount_minor, cur) }} · {{ r.status }}<template v-if="r.reason"> · {{ r.reason }}</template></li></ul>
            </li>
          </ul>
          <form v-if="can('shop.orders') && o.amount_paid_minor < o.totals.total_minor && !['cancelled', 'draft'].includes(o.status)" class="mt-4 flex flex-col gap-2" @submit.prevent="recordPayment">
            <p class="text-small font-medium">{{ t('admin.shop.orders.recordPayment') }}</p>
            <USelect v-model="payment.provider" :items="['cash', 'bank_transfer', 'card_terminal', 'cash_on_delivery', 'pay_at_pickup'].map(p => ({ value: p, label: t(`admin.shop.providers.${p}`) }))" size="sm" />
            <UInputNumber v-model="payment.amount" :min="0" :step="0.01" size="sm" :aria-label="t('admin.shop.orders.amount')" />
            <UInput v-model="payment.reference" :placeholder="t('admin.shop.orders.reference')" size="sm" />
            <UButton type="submit" :label="t('admin.shop.orders.recordPayment')" size="sm" />
          </form>
          <form v-if="can('shop.refunds') && o.refundable_minor > 0" class="mt-4 flex flex-col gap-2" data-testid="refund-form" @submit.prevent="confirmRefund = true">
            <p class="text-small font-medium">{{ t('admin.shop.orders.refund') }} ({{ t('admin.shop.orders.refundable', { amount: money(o.refundable_minor, cur) }) }})</p>
            <div v-for="i in o.items" :key="i.id" class="flex items-center justify-between gap-2 text-small">
              <span class="truncate">{{ i.snapshot.name }}</span>
              <UInputNumber v-model="refund.lines[i.id]" :min="0" :max="i.quantity - i.refunded_quantity" size="xs" class="w-24" :aria-label="t('admin.shop.orders.refundQty', { name: i.snapshot.name })" />
            </div>
            <UCheckbox v-model="refund.shipping" :label="t('admin.shop.orders.refundShipping')" />
            <UCheckbox v-model="refund.restock" :label="t('admin.shop.orders.restock')" />
            <UFormField :label="t('admin.shop.orders.customAmount')" name="refund-amount">
              <UInputNumber v-model="refund.amount" :min="0" :step="0.01" size="sm" />
            </UFormField>
            <UInput v-model="refund.reason" :placeholder="t('admin.shop.orders.reason')" size="sm" />
            <UButton type="submit" color="error" variant="soft" :disabled="refundTotal <= 0 || refundTotal > o.refundable_minor" :label="t('admin.shop.orders.refundAmount', { amount: money(refundTotal, cur) })" size="sm" />
          </form>
        </UCard>
        <UCard>
          <template #header><h2 class="font-medium">{{ t('admin.shop.orders.tagsRisk') }}</h2></template>
          <form class="flex flex-col gap-2" @submit.prevent="saveTags">
            <UInput v-model="tags" :aria-label="t('admin.shop.orders.tag')" :placeholder="t('admin.shop.orders.tagsHint')" size="sm" />
            <UButton type="submit" :label="t('common.save')" color="neutral" variant="outline" size="sm" />
          </form>
          <USelect class="mt-2" :model-value="o.risk_level" :items="['normal', 'review', 'high'].map(r => ({ value: r, label: t(`admin.shop.risk.${r}`) }))" size="sm" :aria-label="t('admin.shop.orders.risk')" @update:model-value="setRisk" />
        </UCard>
      </div>
    </div>

    <MzConfirmDialog v-model:open="confirmRefund" danger :title="t('admin.shop.orders.refund')" :description="t('admin.shop.orders.refundConfirm', { amount: money(refundTotal, cur), restock: refund.restock ? t('admin.shop.orders.restockYes') : t('admin.shop.orders.restockNo') })" :confirm-label="t('admin.shop.orders.refundAmount', { amount: money(refundTotal, cur) })" @confirm="doRefund" />
    <UModal v-model:open="cancelOpen" :title="t('admin.shop.orders.cancel')">
      <template #body>
        <div class="flex flex-col gap-3">
          <USelect v-model="cancelForm.reason" :items="['customer', 'out_of_stock', 'fraud', 'unconfirmed', 'other'].map(r => ({ value: r, label: t(`admin.shop.cancelReasons.${r}`) }))" />
          <UCheckbox v-model="cancelForm.restock" :label="t('admin.shop.orders.restockUnits', { n: restockUnits })" />
          <UCheckbox v-if="can('shop.refunds')" v-model="cancelForm.refund" :label="t('admin.shop.orders.refundPaid', { amount: money(o.refundable_minor, cur) })" />
          <UInput v-model="cancelForm.message" :placeholder="t('admin.shop.orders.reason')" />
          <p class="text-small text-error">{{ t('admin.shop.orders.cancelWarning', { amount: money(cancelForm.refund ? o.refundable_minor : 0, cur), n: cancelForm.restock ? restockUnits : 0 }) }}</p>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="cancelOpen = false" />
        <UButton :label="t('admin.shop.orders.cancel')" color="error" @click="cancel" />
      </template>
    </UModal>
    <UModal v-model:open="editOpen" :title="t('admin.shop.orders.edit')">
      <template #body>
        <div class="flex flex-col gap-3">
          <div v-for="l in editLines" :key="l.variant_id" class="flex items-center justify-between gap-2">
            <span class="text-small">{{ l.name }}</span>
            <UInputNumber v-model="l.quantity" :min="0" size="sm" class="w-28" :aria-label="l.name" />
          </div>
          <div class="flex gap-2">
            <USelect v-model="addSku" :items="(variantChoices?.data ?? []).map((v: Json) => ({ value: v.variant_id, label: `${v.name} ${v.options} (${v.sku})` }))" :placeholder="t('admin.shop.orders.addProduct')" class="flex-1" />
            <UButton icon="i-lucide-plus" :aria-label="t('admin.shop.orders.addProduct')" color="neutral" variant="outline" @click="addLine" />
          </div>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="editOpen = false" />
        <UButton :label="t('common.save')" @click="saveEdit" />
      </template>
    </UModal>
  </div>
</template>
