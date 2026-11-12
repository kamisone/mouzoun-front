<script setup lang="ts">
import type { Party } from '~/composables/useBooking'
import type { PaymentOption, ProductCard, TripItem, TripQuote } from '~/utils/booking-types'

/**
 * New booking by staff (phone, WhatsApp, walk-in, agency...): same quote engine as the website,
 * items added one by one, existing or new customer, optional price override with a mandatory
 * reason, optional payment received now (cash, transfer, card terminal), guest emails optional.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.bookings.new' })
const { t } = useI18n()
const admin = useAdminApi()
const api = useBookingApi()
const toast = useToast()
const { user } = useAuth()
const { money } = useMoney()
const { dateRange, dateTime } = useDate()
const { data: categories } = useGuestCategories()

const { data: products } = await useAsyncData('admin-new-products', async () => {
  const [a, b, c] = await Promise.all([api.products({ kind: 'accommodation' }), api.products({ kind: 'activity' }), api.products({ kind: 'package' })].map(p => p.catch(() => [] as ProductCard[])))
  return [...a!, ...b!, ...c!]
}, { default: () => [] })
const productItems = computed(() => products.value.map(p => ({ label: `${p.name} · ${t(`booking.lists.${p.kind}`)}`, value: p.id })))

// The item being composed.
const productId = ref<string | undefined>(undefined)
const product = computed(() => products.value.find(p => p.id === productId.value) ?? null)
const dates = ref<{ start: string | null, end: string | null }>({ start: null, end: null })
const party = ref<Party>({ adults: 2, children: 0, infants: 0, childAges: [] })
const quantity = ref(1)
const slotId = ref<string | null>(null)
const items = ref<TripItem[]>([])
const guests = computed(() => partyToGuests(party.value, categories.value ?? []))
const draft = computed<TripItem | null>(() => {
  const p = product.value
  if (!p || !guests.value.length) return null
  if (p.kind === 'accommodation' && dates.value.start && dates.value.end) return { kind: 'stay', product_id: p.id, arrival: dates.value.start, departure: dates.value.end, quantity: quantity.value, guests: guests.value }
  if (p.kind === 'activity' && slotId.value) return { kind: 'activity', product_id: p.id, slot_id: slotId.value, guests: guests.value }
  if (p.kind === 'activity' && p.facts.scheduling_mode !== 'fixed_slots' && dates.value.start) return { kind: 'activity', product_id: p.id, date: dates.value.start, guests: guests.value }
  if (p.kind === 'package' && dates.value.start) return { kind: 'package', product_id: p.id, arrival: dates.value.start, guests: guests.value }
  return null
})
function addItem() {
  if (!draft.value) return
  items.value.push(draft.value)
  productId.value = undefined
  slotId.value = null
}

// Quote.
const form = reactive({
  promo_code: '',
  source: 'phone',
  locale: 'fr',
  payment_option: undefined as PaymentOption | undefined,
  skip_guest_emails: false,
  special_requests: '',
  internal_note: '',
  override: false,
  override_total: null as number | null,
  override_reason: '',
  paid_now: null as number | null,
  paid_provider: 'cash',
})
const quote = ref<TripQuote | null>(null)
watchDebounced([items, () => form.promo_code], async () => {
  if (!items.value.length) {
    quote.value = null
    return
  }
  try {
    quote.value = (await admin.quote({ items: items.value, promo_code: form.promo_code || null, locale: form.locale })).quote
    if (!quote.value.payment_options.some(o => o.option === form.payment_option)) form.payment_option = quote.value.payment_options.at(-1)?.option
  }
  catch {
    quote.value = null
  }
}, { debounce: 300, deep: true })

// Customer.
const customerQuery = ref('')
const customerId = ref<string | null>(null)
const { data: matches } = useAsyncData(() => `customers-${customerQuery.value}`, () => (customerQuery.value.length >= 2 ? admin.customers(customerQuery.value) : Promise.resolve([])), { watch: [customerQuery], default: () => [] })
const customer = reactive({ first_name: '', last_name: '', email: '', phone: '', country_code: 'MA' })

const canOverride = computed(() => user.value?.permissions.includes('bookings.override_price') || user.value?.roles.includes('super_admin'))
const euros = (cents: number | null) => (cents == null ? undefined : (cents / 100).toFixed(2))
const saving = ref(false)
async function save() {
  if (!items.value.length || !form.payment_option) return
  saving.value = true
  try {
    const res = await admin.bookings.create({
      items: items.value,
      promo_code: form.promo_code || null,
      customer_id: customerId.value,
      customer: customerId.value ? null : { ...customer },
      source: form.source,
      payment_option: form.payment_option,
      locale: form.locale,
      special_requests: form.special_requests || null,
      skip_guest_emails: form.skip_guest_emails,
      price_override: form.override && form.override_total != null ? { total: euros(form.override_total)!, reason: form.override_reason } : null,
      payment: form.paid_now ? { provider: form.paid_provider, amount: euros(form.paid_now)! } : null,
      internal_note: form.internal_note || null,
    })
    toast.add({ title: t('admin.bookings.created', { reference: res.reference }), color: 'success' })
    await navigateTo(`/admin/bookings/${res.id}`)
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), description: (e as { data?: { error?: { message?: string } } }).data?.error?.message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}
const describe = (q: TripQuote['items'][number]) => (q.arrival && q.departure ? dateRange(q.arrival, q.departure) : q.starts_at ? dateTime(q.starts_at) : q.date ?? '')
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="t('admin.bookings.new')" :breadcrumbs="[{ label: t('admin.bookings.title'), to: '/admin/bookings' }, { label: t('admin.bookings.new') }]" />
    <div class="grid gap-6 xl:grid-cols-3">
      <div class="flex flex-col gap-6 xl:col-span-2">
        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.addItem') }}</h2></template>
          <div class="flex flex-col gap-4">
            <UFormField :label="t('admin.bookings.product')">
              <USelectMenu v-model="productId" :items="productItems" value-key="value" class="w-full" :placeholder="t('admin.bookings.chooseProduct')" />
            </UFormField>
            <template v-if="product">
              <MzAvailabilityCalendar
                v-if="product.kind === 'accommodation' || product.kind === 'package' || product.facts.scheduling_mode !== 'fixed_slots'"
                v-model="dates"
                :product-id="product.kind === 'accommodation' ? product.id : undefined"
              />
              <MzSlotPicker v-else v-model="slotId" :product-id="product.id" :participants="party.adults + party.children" />
              <MzGuestPicker v-model="party" :categories="categories ?? []" />
              <UFormField v-if="product.kind === 'accommodation'" :label="t('admin.bookings.units')"><UInputNumber v-model="quantity" :min="1" :max="20" /></UFormField>
              <UButton :label="t('admin.bookings.addItem')" icon="i-lucide-plus" :disabled="!draft" class="self-start" @click="addItem" />
            </template>
          </div>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.customer') }}</h2></template>
          <div class="flex flex-col gap-4">
            <UInput v-model="customerQuery" icon="i-lucide-search" :placeholder="t('admin.bookings.findCustomer')" :aria-label="t('admin.bookings.findCustomer')" />
            <URadioGroup
              v-if="matches.length"
              v-model="customerId"
              :items="[{ label: t('admin.bookings.newCustomer'), value: null }, ...matches.map(m => ({ label: `${m.first_name} ${m.last_name ?? ''} · ${m.email ?? m.phone ?? ''} (${m.bookings})`, value: m.id }))]"
            />
            <div v-if="!customerId" class="grid gap-3 sm:grid-cols-2">
              <UFormField :label="t('booking.checkout.firstName')" required><UInput v-model="customer.first_name" class="w-full" /></UFormField>
              <UFormField :label="t('booking.checkout.lastName')"><UInput v-model="customer.last_name" class="w-full" /></UFormField>
              <UFormField :label="t('booking.checkout.email')"><UInput v-model="customer.email" type="email" class="w-full" /></UFormField>
              <UFormField :label="t('booking.checkout.phone')"><UInput v-model="customer.phone" type="tel" class="w-full" /></UFormField>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('admin.bookings.options') }}</h2></template>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('admin.bookings.source')">
              <USelect v-model="form.source" :items="['phone', 'whatsapp', 'walk_in', 'email', 'agency', 'admin'].map(s => ({ label: t(`admin.sources.${s}`), value: s }))" class="w-full" />
            </UFormField>
            <UFormField :label="t('admin.bookings.language')">
              <USelect v-model="form.locale" :items="[{ label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }, { label: 'العربية', value: 'ar' }]" class="w-full" />
            </UFormField>
            <UFormField :label="t('booking.promo.label')"><UInput v-model="form.promo_code" class="w-full" /></UFormField>
            <UFormField :label="t('booking.checkout.payment')">
              <USelect v-model="form.payment_option" :items="(quote?.payment_options ?? []).map(o => ({ label: t(`booking.checkout.options.${o.option}`), value: o.option }))" class="w-full" />
            </UFormField>
            <UFormField :label="t('booking.checkout.requests')" class="sm:col-span-2"><UTextarea v-model="form.special_requests" :rows="2" class="w-full" /></UFormField>
            <UFormField :label="t('admin.bookings.internalNote')" class="sm:col-span-2"><UTextarea v-model="form.internal_note" :rows="2" class="w-full" /></UFormField>
            <UCheckbox v-model="form.skip_guest_emails" :label="t('admin.bookings.skipEmails')" class="sm:col-span-2" />
            <template v-if="canOverride">
              <UCheckbox v-model="form.override" :label="t('admin.bookings.override')" class="sm:col-span-2" />
              <template v-if="form.override">
                <UFormField :label="t('admin.bookings.newTotal')"><MzMoneyInput v-model="form.override_total" /></UFormField>
                <UFormField :label="t('admin.bookings.overrideReason')" required><UInput v-model="form.override_reason" class="w-full" /></UFormField>
              </template>
            </template>
            <UFormField :label="t('admin.bookings.paidNow')"><MzMoneyInput v-model="form.paid_now" /></UFormField>
            <UFormField :label="t('admin.bookings.method')">
              <USelect v-model="form.paid_provider" :items="['cash', 'bank_transfer', 'card_terminal', 'other'].map(p => ({ label: t(`admin.providers.${p}`), value: p }))" class="w-full" />
            </UFormField>
          </div>
        </UCard>
      </div>

      <div class="flex flex-col gap-4">
        <UCard>
          <template #header><h2 class="font-medium text-highlighted">{{ t('booking.summary.title') }}</h2></template>
          <p v-if="!items.length" class="text-small text-muted">{{ t('admin.bookings.noItems') }}</p>
          <ul v-else class="flex flex-col divide-y divide-default text-small">
            <li v-for="q in quote?.items ?? []" :key="q.index" class="flex items-start justify-between gap-2 py-2">
              <div>
                <p class="font-medium text-highlighted">{{ q.name }}</p>
                <p class="text-muted">{{ describe(q) }}</p>
                <p v-if="q.issue" class="text-error">{{ t(`booking.issues.${q.issue.code}`, { ...(q.issue.details ?? {}) }, q.issue.message) }}</p>
              </div>
              <div class="flex items-center gap-1">
                <span class="tabular-nums">{{ money(q.total_minor) }}</span>
                <UButton v-if="q.request_index != null" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('booking.trip.remove')" @click="items.splice(q.request_index!, 1)" />
              </div>
            </li>
          </ul>
          <p v-if="quote" class="flex justify-between pt-3 font-medium text-highlighted"><span>{{ t('booking.price.total') }}</span><span class="tabular-nums">{{ money(quote.total_minor) }}</span></p>
        </UCard>
        <UButton :label="t('admin.bookings.create')" size="lg" block :loading="saving" :disabled="!quote || quote.has_issues || !form.payment_option || (!customerId && !customer.first_name)" @click="save" />
      </div>
    </div>
  </div>
</template>
