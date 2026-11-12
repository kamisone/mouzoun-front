<script setup lang="ts">
import type { AdminBookingView } from '~/utils/admin-types'
import type { RegisterGuest } from '~/utils/booking-types'

/**
 * One booking for staff: status, source and money at a glance; items (with units), guests
 * register, payments and refunds, internal notes, tasks, timeline (status changes, emails
 * sent, audit entries) and every action the status allows. Amounts are typed in euros.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.bookings.detail' })
const route = useRoute()
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()
const { money } = useMoney()
const { date, dateRange, dateTime } = useDate()

const id = computed(() => String(route.params.id))
const { data: b, refresh } = await useAsyncData<AdminBookingView | null>(`admin-booking-${id.value}`, () => admin.bookings.get(id.value).catch(() => null))
if (!b.value) throw createError({ statusCode: 404, statusMessage: t('error.notFound') })

const busy = ref<string | null>(null)
async function act(key: string, fn: () => Promise<unknown>, success?: string) {
  busy.value = key
  try {
    await fn()
    if (success) toast.add({ title: success, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), description: (e as { data?: { error?: { message?: string } } }).data?.error?.message, color: 'error' })
  }
  finally {
    busy.value = null
  }
}

const s = computed(() => b.value?.status)
const can = computed(() => b.value?.permissions)
const name = computed(() => [b.value?.customer.first_name, b.value?.customer.last_name].filter(Boolean).join(' '))

// Decline / cancel dialogs.
const declineOpen = ref(false)
const declineReason = ref('')
const cancelOpen = ref(false)
const cancelForm = reactive({ reason: '', refund: 'policy' as 'policy' | 'custom' | 'none', amount: null as number | null })
/** The API takes amounts as euro strings ("45.50"); MzMoneyInput works in cents. */
const euros = (cents: number | null) => (cents == null ? undefined : (cents / 100).toFixed(2))
const itemCancel = ref<string | null>(null)

// Payments.
const paymentOpen = ref(false)
const payment = reactive({ provider: 'cash', purpose: 'balance', amount: null as number | null, note: '' })
const refundFor = ref<string | null>(null)
const refund = reactive({ amount: null as number | null, reason: '' })
const providers = computed(() => ['cash', 'bank_transfer', 'card_terminal', 'other'].map(p => ({ label: t(`admin.providers.${p}`), value: p })))
const purposes = computed(() => ['deposit', 'balance', 'full', 'extra'].map(p => ({ label: t(`admin.purposes.${p}`), value: p })))

// Notes.
const note = ref('')
const notes = reactive({ internal: b.value?.internal_notes ?? '' })

// Register.
const register = ref<RegisterGuest[] | null>(null)
const revealed = ref(false)
async function loadRegister() {
  const res = await admin.bookings.guests(id.value)
  register.value = res.guests
  revealed.value = res.revealed
}

const timeline = computed(() => b.value?.timeline ?? [])
function describe(e: AdminBookingView['timeline'][number]) {
  if (e.kind === 'status') return t('admin.timeline.status', { from: e.from ? t(`status.${e.from}`) : '—', to: t(`status.${e.to}`) })
  if (e.kind === 'email') return t('admin.timeline.email', { subject: e.subject ?? e.template, status: e.status })
  return t(`admin.timeline.actions.${e.action?.replace('.', '_')}`, e.action ?? '')
}
const resendItems = computed(() => [
  [{ label: t('admin.bookings.resend.confirmation'), onSelect: () => act('resend', () => admin.bookings.resend(id.value, 'confirmation'), t('admin.bookings.queued')) },
    { label: t('admin.bookings.resend.payment_link'), onSelect: () => act('resend', () => admin.bookings.resend(id.value, 'payment_link'), t('admin.bookings.queued')) },
    { label: t('admin.bookings.resend.balance'), onSelect: () => act('resend', () => admin.bookings.resend(id.value, 'balance'), t('admin.bookings.queued')) },
    { label: t('admin.bookings.resend.precheckin'), onSelect: () => act('resend', () => admin.bookings.resend(id.value, 'precheckin'), t('admin.bookings.queued')) }],
])
</script>

<template>
  <div v-if="b" class="flex flex-col gap-6">
    <MzPageHeader
      :title="`${b.reference} · ${name}`"
      :breadcrumbs="[{ label: t('admin.bookings.title'), to: '/admin/bookings' }, { label: b.reference }]"
    >
      <template #actions>
        <template v-if="can?.write">
          <UButton v-if="s === 'pending'" :label="t('admin.bookings.accept')" icon="i-lucide-check" :loading="busy === 'accept'" @click="act('accept', () => admin.bookings.accept(id), t('admin.bookings.accepted'))" />
          <UButton v-if="s === 'pending'" :label="t('admin.bookings.decline')" color="neutral" variant="outline" @click="declineOpen = true" />
          <UButton v-if="s === 'awaiting_payment'" :label="t('admin.bookings.confirmWithout')" color="neutral" variant="outline" :loading="busy === 'confirm'" @click="act('confirm', () => admin.bookings.setStatus(id, 'confirmed'))" />
          <UButton v-if="s === 'confirmed'" :label="t('admin.bookings.checkIn')" icon="i-lucide-log-in" :loading="busy === 'in'" @click="act('in', () => admin.bookings.setStatus(id, 'checked_in'))" />
          <UButton v-if="s === 'checked_in'" :label="t('admin.bookings.checkOut')" icon="i-lucide-log-out" :loading="busy === 'out'" @click="act('out', () => admin.bookings.setStatus(id, 'completed'))" />
          <UButton v-if="s === 'confirmed'" :label="t('admin.bookings.noShow')" color="neutral" variant="ghost" :loading="busy === 'noshow'" @click="act('noshow', () => admin.bookings.setStatus(id, 'no_show'))" />
          <UDropdownMenu :items="resendItems">
            <UButton :label="t('admin.bookings.resend.label')" icon="i-lucide-mail" color="neutral" variant="ghost" />
          </UDropdownMenu>
        </template>
        <UButton v-if="can?.cancel && ['pending', 'awaiting_payment', 'confirmed'].includes(s!)" :label="t('admin.bookings.cancel')" color="error" variant="ghost" @click="cancelOpen = true" />
      </template>
    </MzPageHeader>

    <div class="grid gap-4 md:grid-cols-4">
      <UCard><p class="text-small text-muted">{{ t('admin.bookings.status') }}</p><MzStatusBadge :status="b.status" /><p class="pt-1 text-caption text-muted">{{ t(`admin.sources.${b.source}`) }}</p></UCard>
      <UCard><p class="text-small text-muted">{{ t('admin.bookings.dates') }}</p><p class="font-medium text-highlighted">{{ b.arrival ? (b.departure ? dateRange(b.arrival, b.departure) : date(b.arrival)) : '—' }}</p><p class="text-caption text-muted">{{ t('admin.bookings.party', { adults: b.party.adults, children: b.party.children, infants: b.party.infants }) }}</p></UCard>
      <UCard><p class="text-small text-muted">{{ t('booking.price.total') }}</p><p class="font-medium tabular-nums text-highlighted">{{ money(b.totals.total_minor, b.currency) }}</p><p class="text-caption text-muted">{{ t('admin.bookings.paidOf', { paid: money(b.totals.paid_minor, b.currency) }) }}</p></UCard>
      <UCard><p class="text-small text-muted">{{ t('admin.bookings.balance') }}</p><p class="font-medium tabular-nums" :class="b.totals.balance_minor ? 'text-warning' : 'text-success'">{{ money(b.totals.balance_minor, b.currency) }}</p><p class="text-caption text-muted">{{ b.totals.balance_due_on ? date(b.totals.balance_due_on, 'medium') : (b.balance_collection ? t(`admin.collection.${b.balance_collection}`) : '') }}</p></UCard>
    </div>

    <UAlert v-if="b.hold_expires_at && ['pending', 'awaiting_payment'].includes(b.status)" color="warning" variant="subtle" icon="i-lucide-hourglass" :title="t('admin.bookings.holdUntil', { date: dateTime(b.hold_expires_at) })" />

    <div class="grid gap-6 xl:grid-cols-3">
      <div class="flex flex-col gap-6 xl:col-span-2">
        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.items') }}</h2></template>
          <ul class="flex flex-col divide-y divide-default">
            <li v-for="i in b.items" :key="i.id" class="flex items-start justify-between gap-3 py-2" :class="{ 'ps-6': i.parent_id, 'opacity-60': i.status === 'cancelled' }">
              <div class="min-w-0">
                <p class="font-medium text-highlighted">{{ i.name }}<span v-if="i.quantity > 1"> × {{ i.quantity }}</span></p>
                <p class="text-small text-muted">
                  {{ i.starts_at ? dateTime(i.starts_at) : i.arrival && i.departure ? dateRange(i.arrival, i.departure) : '' }}
                  <template v-if="i.units.length"> · {{ i.units.join(', ') }}</template>
                  <template v-if="i.language"> · {{ i.language }}</template>
                  <template v-if="i.status === 'cancelled'"> · {{ t('booking.manage.itemCancelled') }}</template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="tabular-nums">{{ money(i.total_minor, b.currency) }}</span>
                <UButton v-if="can?.cancel && i.status === 'active' && !i.parent_id && b.items.filter(x => !x.parent_id && x.status === 'active').length > 1" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.bookings.cancelItem')" @click="itemCancel = i.id" />
              </div>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-medium text-highlighted">{{ t('admin.bookings.payments') }}</h2>
              <UButton v-if="can?.record_offline" :label="t('admin.bookings.recordPayment')" icon="i-lucide-banknote" size="sm" color="neutral" variant="outline" @click="paymentOpen = true" />
            </div>
          </template>
          <ul v-if="b.payments.length" class="flex flex-col divide-y divide-default text-small">
            <li v-for="p in b.payments" :key="p.id" class="flex items-center justify-between gap-3 py-2">
              <span>{{ t(`admin.providers.${p.provider}`, p.provider) }} · {{ t(`admin.purposes.${p.purpose}`) }} · {{ p.paid_at ? dateTime(p.paid_at) : dateTime(p.created_at) }}</span>
              <span class="flex items-center gap-2">
                <MzStatusBadge :status="p.status" size="sm" />
                <span class="tabular-nums">{{ money(p.amount_minor, b.currency) }}</span>
                <UButton v-if="can?.refund && ['succeeded', 'partially_refunded'].includes(p.status)" :label="t('admin.bookings.refund')" size="xs" color="neutral" variant="ghost" @click="refundFor = p.id" />
              </span>
            </li>
          </ul>
          <p v-else class="text-small text-muted">{{ t('admin.bookings.noPayments') }}</p>
          <ul v-if="b.refunds.length" class="mt-3 flex flex-col gap-1 border-t border-default pt-3 text-small">
            <li v-for="r in b.refunds" :key="r.id" class="flex justify-between gap-3 text-muted">
              <span>{{ t('admin.bookings.refunded') }} · {{ dateTime(r.at) }} · {{ r.reason }}</span>
              <span class="flex items-center gap-2"><MzStatusBadge :status="r.status" size="sm" /><span class="tabular-nums">−{{ money(r.amount_minor, b.currency) }}</span></span>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-medium text-highlighted">{{ t('admin.bookings.register') }}</h2>
              <UBadge :label="b.precheckin_completed ? t('booking.precheckin.complete') : t('admin.bookings.registerMissing')" :color="b.precheckin_completed ? 'success' : 'warning'" variant="subtle" />
            </div>
          </template>
          <UButton v-if="!register" :label="t('admin.bookings.showRegister')" size="sm" color="neutral" variant="outline" @click="loadRegister" />
          <table v-else class="w-full text-small">
            <thead><tr class="text-start text-muted"><th class="text-start">{{ t('booking.checkout.lastName') }}</th><th class="text-start">{{ t('booking.precheckin.nationality') }}</th><th class="text-start">{{ t('booking.precheckin.birthDate') }}</th><th class="text-start">{{ t('booking.precheckin.docNumber') }}</th></tr></thead>
            <tbody>
              <tr v-for="g in register" :key="g.id">
                <td>{{ g.first_name }} {{ g.last_name }}</td>
                <td>{{ g.nationality }}</td>
                <td>{{ g.date_of_birth ? date(g.date_of_birth, 'medium') : '' }}</td>
                <td dir="ltr">{{ g.id_document_type ? t(`booking.precheckin.docs.${g.id_document_type}`) : '' }} {{ g.id_document_number }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="register && !revealed" class="pt-2 text-caption text-muted">{{ t('admin.bookings.masked') }}</p>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.timeline') }}</h2></template>
          <ol class="flex flex-col gap-3 border-s border-default ps-4 text-small">
            <li v-for="(e, i) in timeline" :key="i">
              <p class="text-highlighted">{{ describe(e) }}</p>
              <p class="text-caption text-muted">{{ dateTime(e.at) }}<template v-if="e.by"> · {{ e.by }}</template><template v-if="e.note"> · {{ e.note }}</template><template v-if="e.error"> · {{ e.error }}</template></p>
            </li>
          </ol>
        </UCard>
      </div>

      <div class="flex flex-col gap-6">
        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.guest') }}</h2></template>
          <p class="font-medium text-highlighted">{{ name }}</p>
          <p class="text-small"><a v-if="b.customer.email" :href="`mailto:${b.customer.email}`" class="link-underline">{{ b.customer.email }}</a></p>
          <p class="text-small" dir="ltr"><a v-if="b.customer.phone" :href="`tel:${b.customer.phone}`" class="link-underline">{{ b.customer.phone }}</a></p>
          <p class="pt-2 text-caption text-muted">{{ t('admin.bookings.customerBookings', { n: b.customer.bookings_count }) }} · {{ b.customer.marketing_consent ? t('admin.bookings.consent') : t('admin.bookings.noConsent') }}</p>
          <p v-if="b.estimated_arrival_time" class="pt-2 text-small">{{ t('booking.checkout.arrivalTime') }} : {{ b.estimated_arrival_time.slice(0, 5) }}</p>
          <p v-if="b.special_requests" class="pt-2 text-small whitespace-pre-line">« {{ b.special_requests }} »</p>
          <p class="pt-2 text-caption text-muted">{{ t('admin.bookings.terms', { version: b.terms.version ?? '—' }) }}</p>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.notes') }}</h2></template>
          <UTextarea v-model="notes.internal" :rows="2" :placeholder="t('admin.bookings.pinnedNote')" class="w-full" @blur="act('pinned', () => admin.bookings.update(id, { internal_notes: notes.internal }))" />
          <form class="flex gap-2 pt-3" @submit.prevent="act('note', () => admin.bookings.note(id, note).then(() => (note = '')))">
            <UInput v-model="note" :placeholder="t('admin.bookings.addNote')" class="flex-1" />
            <UButton type="submit" icon="i-lucide-send" :loading="busy === 'note'" :disabled="!note.trim()" :aria-label="t('admin.bookings.addNote')" />
          </form>
          <ul class="flex flex-col gap-3 pt-3 text-small">
            <li v-for="n in b.notes" :key="n.id"><p class="whitespace-pre-line">{{ n.body }}</p><p class="text-caption text-muted">{{ n.by }} · {{ dateTime(n.at) }}</p></li>
          </ul>
        </UCard>

        <UCard v-if="b.tasks.length">
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.tasks') }}</h2></template>
          <ul class="flex flex-col gap-3 text-small">
            <li v-for="task in b.tasks" :key="task.id" class="flex items-start justify-between gap-2">
              <span :class="task.status === 'open' ? 'text-highlighted' : 'text-muted line-through'">{{ task.title }}</span>
              <UButton v-if="task.status === 'open'" :label="t('admin.bookings.done')" size="xs" color="neutral" variant="outline" @click="act('task', () => admin.tasks.update(task.id, 'done'))" />
            </li>
          </ul>
        </UCard>
      </div>
    </div>

    <!-- Dialogs -->
    <UModal v-model:open="declineOpen" :title="t('admin.bookings.decline')">
      <template #body>
        <UFormField :label="t('admin.bookings.declineReason')" :help="t('admin.bookings.declineHelp')">
          <UTextarea v-model="declineReason" :rows="3" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <UButton :label="t('admin.bookings.decline')" color="error" :loading="busy === 'decline'" @click="act('decline', () => admin.bookings.decline(id, declineReason), t('admin.bookings.declined')).then(() => (declineOpen = false))" />
      </template>
    </UModal>

    <UModal v-model:open="cancelOpen" :title="t('admin.bookings.cancel')">
      <template #body>
        <div class="flex flex-col gap-4">
          <URadioGroup
            v-model="cancelForm.refund"
            :items="[{ label: t('admin.bookings.refundPolicy'), value: 'policy' }, { label: t('admin.bookings.refundCustom'), value: 'custom' }, { label: t('admin.bookings.refundNone'), value: 'none' }]"
            :disabled="!can?.refund"
          />
          <UFormField v-if="cancelForm.refund === 'custom'" :label="t('admin.bookings.amount')"><MzMoneyInput v-model="cancelForm.amount" /></UFormField>
          <UFormField :label="t('booking.manage.cancelReason')"><UTextarea v-model="cancelForm.reason" :rows="2" class="w-full" /></UFormField>
        </div>
      </template>
      <template #footer>
        <UButton
          :label="t('booking.manage.confirmCancel')"
          color="error"
          :loading="busy === 'cancel'"
          @click="act('cancel', () => admin.bookings.cancel(id, { reason: cancelForm.reason, refund: can?.refund ? cancelForm.refund : 'none', amount: euros(cancelForm.amount) }), t('admin.bookings.cancelled')).then(() => (cancelOpen = false))"
        />
      </template>
    </UModal>

    <UModal :open="!!itemCancel" :title="t('admin.bookings.cancelItem')" @update:open="(v: boolean) => { if (!v) itemCancel = null }">
      <template #body><p>{{ t('admin.bookings.cancelItemText') }}</p></template>
      <template #footer>
        <UButton :label="t('admin.bookings.cancelItem')" color="error" :loading="busy === 'item'" @click="act('item', () => admin.bookings.cancelItems(id, { item_ids: [itemCancel!], refund: can?.refund ? 'policy' : 'none' })).then(() => (itemCancel = null))" />
      </template>
    </UModal>

    <UModal v-model:open="paymentOpen" :title="t('admin.bookings.recordPayment')">
      <template #body>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('admin.bookings.method')"><USelect v-model="payment.provider" :items="providers" class="w-full" /></UFormField>
          <UFormField :label="t('admin.bookings.purpose')"><USelect v-model="payment.purpose" :items="purposes" class="w-full" /></UFormField>
          <UFormField :label="t('admin.bookings.amount')" class="sm:col-span-2"><MzMoneyInput v-model="payment.amount" /></UFormField>
          <UFormField :label="t('admin.bookings.paymentNote')" class="sm:col-span-2"><UInput v-model="payment.note" class="w-full" /></UFormField>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('admin.bookings.record')" :loading="busy === 'payment'" :disabled="!payment.amount" @click="act('payment', () => admin.bookings.recordPayment(id, { provider: payment.provider, purpose: payment.purpose, amount: euros(payment.amount)!, note: payment.note }), t('admin.bookings.recorded')).then(() => { paymentOpen = false; payment.amount = null })" />
      </template>
    </UModal>

    <UModal :open="!!refundFor" :title="t('admin.bookings.refund')" @update:open="(v: boolean) => { if (!v) refundFor = null }">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField :label="t('admin.bookings.amount')"><MzMoneyInput v-model="refund.amount" /></UFormField>
          <UFormField :label="t('admin.bookings.refundReason')"><UInput v-model="refund.reason" class="w-full" /></UFormField>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('admin.bookings.refund')" color="error" :loading="busy === 'refund'" :disabled="!refund.amount" @click="act('refund', () => admin.bookings.refund(id, { payment_id: refundFor!, amount: euros(refund.amount)!, reason: refund.reason }), t('admin.bookings.refundDone')).then(() => { refundFor = null; refund.amount = null })" />
      </template>
    </UModal>
  </div>
</template>
