<script setup lang="ts">
import type { SavedTraveller } from '~/utils/account-types'
import type { BookingView, CancellationPreview, RegisterGuest } from '~/utils/booking-types'
import { countries } from '~/utils/contact'

/**
 * Confirmation and self-service page of one booking, opened with the signed link of the
 * confirmation email (`?t=`), a magic link (`?m=`) or from this device. Clear success state,
 * practical information, calendar / receipt / share, then: pay what is due, arrival details,
 * online pre-check-in (guest register) and cancellation with the refund shown first.
 */
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const api = useBookingApi()
const access = useBookingAccess()
const toast = useToast()
const appConfig = useAppConfig()
const { money } = useMoney()
const { date, dateRange, dateTime } = useDate()
const { purchaseOnce } = useAnalytics()
const accountState = useAccount()
const createAccountOpen = ref(false)

// Pre-check-in from saved travellers (signed in).
const savedTravellers = ref<SavedTraveller[]>([])
watch(() => accountState.account.value, async (a) => {
  if (a) savedTravellers.value = (await useAccountApi().travellers.list().catch(() => ({ travellers: [] }))).travellers
}, { immediate: true })
function fillFromSaved(g: RegisterGuest, id: string) {
  const s = savedTravellers.value.find(x => x.id === id)
  if (!s) return
  Object.assign(g, {
    first_name: s.first_name,
    last_name: s.last_name,
    date_of_birth: s.date_of_birth,
    nationality: s.nationality,
    id_document_type: (s.id_document_type ?? g.id_document_type) as RegisterGuest['id_document_type'],
  })
}
useHead({ title: () => `${t('booking.manage.title')} ${String(route.params.reference)}`, meta: [{ name: 'robots', content: 'noindex' }] })

const reference = computed(() => String(route.params.reference).toUpperCase())
const token = ref<string | null>(null)
const booking = ref<BookingView | null>(null)
const loading = ref(true)
const linkError = ref<string | null>(null)
const confirming = ref(false)

async function load() {
  if (token.value === null) return
  booking.value = await api.booking.get(reference.value, token.value)
}

onMounted(async () => {
  try {
    if (typeof route.query.m === 'string') {
      const res = await api.booking.redeem(reference.value, route.query.m).catch((e) => {
        linkError.value = t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic'))
        return null
      })
      if (res) token.value = res.access_token
    }
    token.value ??= typeof route.query.t === 'string' ? route.query.t : access.get(reference.value)
    // Signed in: the account opens its own bookings without the email token.
    const signedIn = await accountState.load()
    if (!token.value && signedIn) token.value = ''
    if (token.value !== null) {
      if (token.value) access.remember(reference.value, token.value)
      // Keep the token out of the address bar (shared screenshots, history).
      await router.replace({ query: { ...route.query, t: undefined, m: undefined } })
      await load()
      if (route.query.paid && booking.value?.status === 'awaiting_payment') await pollPayment()
    }
  }
  catch {
    booking.value = null
  }
  finally {
    loading.value = false
  }
})

/** After the payment provider: the webhook confirms; poll up to ~30 s. */
async function pollPayment() {
  confirming.value = true
  for (let i = 0; i < 15 && booking.value?.status === 'awaiting_payment'; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const s = await api.booking.status(reference.value, token.value!).catch(() => null)
    if (s && s.status !== 'awaiting_payment') await load()
  }
  confirming.value = false
}

const b = computed(() => booking.value)
const isNew = computed(() => !!(route.query.new || route.query.paid))
watch(b, (v) => {
  if (v && ['confirmed', 'pending'].includes(v.status) && isNew.value) purchaseOnce(v.reference, v.totals.total_minor, v.currency)
})
const topItems = computed(() => b.value?.items.filter(i => !i.parent_id) ?? [])
const childItems = (id: string) => b.value?.items.filter(i => i.parent_id === id) ?? []
const when = (i: BookingView['items'][number]) => (i.arrival && i.departure && i.kind !== 'extra' ? dateRange(i.arrival, i.departure) : i.starts_at ? dateTime(i.starts_at) : i.arrival ? date(i.arrival) : '')
const freeUntil = computed(() => b.value?.cancellation.find(s => s.refund_percent >= 100)?.until ?? null)
const party = computed(() => (b.value ? b.value.party.adults + b.value.party.children : 0))

const status = computed(() => {
  switch (b.value?.status) {
    case 'confirmed': return { icon: 'i-lucide-circle-check', tone: 'text-success', title: t('booking.manage.confirmed') }
    case 'pending': return { icon: 'i-lucide-hourglass', tone: 'text-warning', title: t('booking.manage.pending') }
    case 'awaiting_payment': return { icon: 'i-lucide-credit-card', tone: 'text-warning', title: t('booking.manage.awaitingPayment') }
    case 'cancelled': return { icon: 'i-lucide-circle-x', tone: 'text-muted', title: t('booking.manage.cancelled') }
    case 'expired': return { icon: 'i-lucide-circle-x', tone: 'text-muted', title: t('booking.manage.expired') }
    case 'checked_in': return { icon: 'i-lucide-tent', tone: 'text-success', title: t('booking.manage.checkedIn') }
    case 'completed': return { icon: 'i-lucide-heart', tone: 'text-success', title: t('booking.manage.completed') }
    default: return { icon: 'i-lucide-info', tone: 'text-muted', title: b.value?.status ?? '' }
  }
})

// Practical info.
const lat = appConfig.site.location.lat
const lng = appConfig.site.location.lng
const googleMaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
const whatsapp = computed(() => (appConfig.site.whatsapp ? `https://wa.me/${appConfig.site.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(reference.value)}` : null))
const checkIn = computed(() => b.value?.items.find(i => i.check_in_from)?.check_in_from?.slice(0, 5) ?? null)

const googleCalendar = computed(() => {
  if (!b.value?.arrival) return null
  const start = b.value.arrival.replaceAll('-', '')
  const end = (b.value.departure ?? b.value.arrival).replaceAll('-', '')
  const text = encodeURIComponent(`Mouzoun — ${reference.value}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&location=${encodeURIComponent(appConfig.site.address)}`
})
async function share() {
  const data = { title: `Mouzoun — ${reference.value}`, text: b.value?.arrival ? dateRange(b.value.arrival, b.value.departure ?? b.value.arrival) : '', url: `${window.location.origin}${localePath('/')}` }
  if (navigator.share) await navigator.share(data).catch(() => null)
  else {
    await navigator.clipboard.writeText(data.url)
    toast.add({ title: t('booking.manage.linkCopied') })
  }
}

// Details.
const details = reactive({ estimated_arrival_time: undefined as string | undefined, special_requests: '' })
watch(b, (v) => {
  details.estimated_arrival_time = v?.estimated_arrival_time?.slice(0, 5)
  details.special_requests = v?.special_requests ?? ''
}, { immediate: true })
const savingDetails = ref(false)
async function saveDetails() {
  savingDetails.value = true
  try {
    booking.value = await api.booking.update(reference.value, token.value!, { estimated_arrival_time: details.estimated_arrival_time ?? null, special_requests: details.special_requests || null })
    toast.add({ title: t('booking.manage.saved'), color: 'success' })
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    savingDetails.value = false
  }
}
const arrivalTimes = Array.from({ length: 23 }, (_, i) => `${String(12 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

// Pre-check-in.
const register = ref<RegisterGuest[]>([])
const idNumbers = ref(true)
const savingRegister = ref(false)
async function loadRegister() {
  const res = await api.booking.guests(reference.value, token.value!)
  idNumbers.value = res.id_numbers_enabled
  const need = Math.max(1, party.value)
  register.value = res.guests.length
    ? res.guests.map(g => ({ ...g, id_document_number: '' }))
    : Array.from({ length: need }, (_, i) => ({ first_name: i === 0 ? b.value!.customer.first_name : '', last_name: i === 0 ? (b.value!.customer.last_name ?? '') : '', nationality: b.value!.customer.country_code, date_of_birth: null, id_document_type: 'passport', id_document_number: '', is_lead: i === 0 }))
}
async function saveRegister() {
  savingRegister.value = true
  try {
    const res = await api.booking.saveGuests(reference.value, token.value!, register.value.map(g => ({ ...g, id_document_number: g.id_document_number || null })))
    toast.add({ title: res.complete ? t('booking.precheckin.complete') : t('booking.precheckin.saved'), color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    savingRegister.value = false
  }
}
const countryItems = computed(() => countries(locale.value))
const docTypes = computed(() => (['passport', 'national_id', 'residence_permit', 'driving_licence', 'other'] as const).map(v => ({ value: v, label: t(`booking.precheckin.docs.${v}`) })))

// Cancellation.
const cancelOpen = ref(false)
const preview = ref<CancellationPreview | null>(null)
const reason = ref('')
const cancelling = ref(false)
async function openCancel() {
  preview.value = await api.booking.cancellation(reference.value, token.value!)
  cancelOpen.value = true
}
async function cancel() {
  cancelling.value = true
  try {
    const res = await api.booking.cancel(reference.value, token.value!, reason.value || undefined)
    cancelOpen.value = false
    toast.add({ title: t('booking.manage.cancelledToast', { amount: money(res.refund_minor, b.value?.currency) }), color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic')), color: 'error' })
  }
  finally {
    cancelling.value = false
  }
}
function printReceipt() {
  window.print()
}
</script>

<template>
  <MzContainer class="pt-12 pb-24 lg:pt-16 print:pt-0">
    <MzSkeleton v-if="loading" variant="card" />

    <MzEmptyState v-else-if="!b" icon="i-lucide-link" :title="linkError ?? t('booking.manage.noAccess')" :description="t('booking.manage.noAccessText')">
      <UButton :to="localePath('/booking/find')" :label="t('booking.find.title')" />
    </MzEmptyState>

    <div v-else class="flex flex-col gap-16" data-testid="booking-page">
      <!-- Success / status -->
      <header class="flex flex-col gap-4">
        <p class="flex items-center gap-2 text-body font-medium" :class="status.tone">
          <UIcon :name="status.icon" class="size-6" aria-hidden="true" />{{ status.title }}
        </p>
        <h1 class="text-display-lg">
          <span class="sr-only">{{ t('booking.manage.reference') }} </span>
          <span data-testid="booking-reference" class="lining-nums">{{ b.reference }}</span>
        </h1>
        <p v-if="confirming" class="text-body-lg text-muted" role="status">{{ t('booking.manage.confirmingPayment') }}</p>
        <p v-else-if="b.status === 'pending'" class="text-body-lg text-muted">{{ t('booking.manage.pendingText', { email: b.customer.email }) }}</p>
        <p v-else-if="isNew && b.customer.email && b.status === 'confirmed'" class="text-body-lg text-muted">{{ t('booking.manage.sentTo', { email: b.customer.email }) }}</p>
        <p v-if="b.status === 'awaiting_payment' && !confirming" class="flex flex-wrap items-center gap-3">
          <span class="text-muted">{{ t('booking.manage.payToConfirm', { amount: money(b.totals.due_now_minor, b.currency) }) }}</span>
          <UButton :to="{ path: localePath(`/booking/${b.reference}/pay`), query: { t: token } }" :label="t('booking.manage.payNow')" />
        </p>
        <div class="flex flex-wrap gap-2 pt-2 print:hidden">
          <UButton v-if="token" :to="api.booking.icsUrl(b.reference, token)" external icon="i-lucide-calendar-plus" :label="t('booking.manage.addCalendar')" color="neutral" variant="outline" size="sm" />
          <UButton v-if="googleCalendar" :to="googleCalendar" target="_blank" icon="i-simple-icons-googlecalendar" :label="t('booking.manage.googleCalendar')" color="neutral" variant="outline" size="sm" />
          <UButton icon="i-lucide-receipt" :label="t('booking.manage.receipt')" color="neutral" variant="outline" size="sm" @click="printReceipt" />
          <UButton icon="i-lucide-share-2" :label="t('booking.manage.share')" color="neutral" variant="outline" size="sm" @click="share" />
        </div>
      </header>

      <!-- One tap: an account to find this trip again (a code goes to the booking address). -->
      <section
        v-if="isNew && accountState.ready.value && !accountState.account.value && b.customer.email"
        class="flex flex-col gap-3 rounded-sm bg-elevated p-6 ring ring-default print:hidden"
        aria-labelledby="create-account-title"
      >
        <h2 id="create-account-title" class="font-display text-h3 text-highlighted">{{ t('account.confirmation.title') }}</h2>
        <p class="text-muted">{{ t('account.confirmation.text') }}</p>
        <UButton :label="t('account.confirmation.cta')" icon="i-lucide-user-round-plus" class="self-start" data-testid="create-account" @click="createAccountOpen = true" />
        <UModal v-model:open="createAccountOpen" :title="t('account.signin.title')" :ui="{ title: 'sr-only' }">
          <template #body>
            <MzSignInPanel :email="b.customer.email" auto-send :heading-level="2" :return-to="`/booking/${b.reference}`" @signed-in="createAccountOpen = false" />
          </template>
        </UModal>
      </section>

      <div class="grid gap-12 lg:grid-cols-12">
        <div class="flex flex-col gap-16 lg:col-span-7">
          <!-- Items -->
          <section aria-labelledby="your-trip">
            <h2 id="your-trip" class="text-h2 pb-4">{{ t('booking.summary.title') }}</h2>
            <ul class="flex flex-col divide-y divide-default border-y border-default">
              <li v-for="i in topItems" :key="i.id" class="flex flex-col gap-2 py-4" :class="{ 'opacity-60': i.status === 'cancelled' }">
                <p class="flex justify-between gap-4">
                  <span class="font-medium text-highlighted">{{ i.name }}<span v-if="i.status === 'cancelled'" class="text-small text-muted"> · {{ t('booking.manage.itemCancelled') }}</span></span>
                  <span class="tabular-nums">{{ money(i.total_minor, b.currency) }}</span>
                </p>
                <p class="text-small text-muted">{{ when(i) }}<template v-if="i.units.length"> · {{ i.units.join(', ') }}</template></p>
                <ul v-if="childItems(i.id).length" class="flex flex-col gap-1 border-s border-default ps-4 text-small text-muted">
                  <li v-for="c in childItems(i.id)" :key="c.id" class="flex justify-between gap-3">
                    <span>{{ c.name }}<template v-if="c.quantity > 1"> × {{ c.quantity }}</template></span>
                    <span class="tabular-nums">{{ c.total_minor ? money(c.total_minor, b.currency) : '' }}</span>
                  </li>
                </ul>
              </li>
            </ul>
            <dl class="flex flex-col gap-1 pt-4 text-small">
              <div v-if="b.totals.discount_minor" class="flex justify-between text-success"><dt>{{ t('booking.price.discount') }}</dt><dd class="tabular-nums">−{{ money(b.totals.discount_minor, b.currency) }}</dd></div>
              <div v-if="b.totals.tax_minor" class="flex justify-between text-muted"><dt>{{ t('booking.price.taxes') }}</dt><dd class="tabular-nums">+{{ money(b.totals.tax_minor, b.currency) }}</dd></div>
              <div class="flex justify-between text-body font-medium text-highlighted"><dt>{{ t('booking.price.total') }}</dt><dd class="tabular-nums">{{ money(b.totals.total_minor, b.currency) }}</dd></div>
              <div class="flex justify-between"><dt>{{ t('booking.manage.paid') }}</dt><dd class="tabular-nums" data-testid="paid-amount">{{ money(b.totals.paid_minor, b.currency) }}</dd></div>
              <div v-if="b.totals.balance_minor && !['cancelled', 'expired'].includes(b.status)" class="flex justify-between font-medium text-highlighted">
                <dt>{{ b.totals.balance_due_on ? t('booking.summary.dueOn', { date: date(b.totals.balance_due_on) }) : t('booking.summary.dueAtCamp') }}</dt>
                <dd class="tabular-nums">{{ money(b.totals.balance_minor, b.currency) }}</dd>
              </div>
            </dl>
            <UButton
              v-if="b.can.pay && b.status === 'confirmed' && b.balance_collection !== 'on_site'"
              :to="{ path: localePath(`/booking/${b.reference}/pay`), query: { t: token } }"
              :label="t('booking.manage.payBalance', { amount: money(b.totals.balance_minor, b.currency) })"
              class="mt-4 print:hidden"
            />
          </section>

          <!-- Cancellation policy -->
          <section v-if="!['cancelled', 'expired'].includes(b.status)" aria-labelledby="policy" class="flex flex-col gap-3">
            <h2 id="policy" class="text-h3">{{ t('booking.checkout.cancellation') }}</h2>
            <MzCancellationSummary :steps="b.cancellation" />
            <p v-if="freeUntil" class="sr-only">{{ dateTime(freeUntil) }}</p>
          </section>

          <!-- Arrival details -->
          <section v-if="b.can.edit" aria-labelledby="arrival" class="flex flex-col gap-4 print:hidden">
            <h2 id="arrival" class="text-h3">{{ t('booking.manage.arrivalDetails') }}</h2>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('booking.checkout.arrivalTime')">
                <USelect v-model="details.estimated_arrival_time" :items="arrivalTimes" :placeholder="t('booking.checkout.arrivalTimeUnknown')" class="w-full" />
              </UFormField>
              <UFormField :label="t('booking.checkout.requests')" :help="t('booking.checkout.requestsHelp')" class="sm:col-span-2">
                <UTextarea v-model="details.special_requests" :rows="3" class="w-full" />
              </UFormField>
            </div>
            <UButton :label="t('common.save')" color="neutral" variant="outline" class="self-start" :loading="savingDetails" @click="saveDetails" />
          </section>

          <!-- Pre-check-in -->
          <section v-if="b.can.precheckin" id="precheckin" aria-labelledby="precheckin-title" class="flex flex-col gap-4 print:hidden">
            <h2 id="precheckin-title" class="text-h3">{{ t('booking.precheckin.title') }}</h2>
            <p class="text-muted">{{ t('booking.precheckin.text') }}</p>
            <UBadge v-if="b.precheckin_completed" :label="t('booking.precheckin.complete')" color="success" variant="subtle" class="self-start" />
            <UButton v-if="!register.length" :label="b.precheckin_completed ? t('booking.precheckin.edit') : t('booking.precheckin.start')" class="self-start" @click="loadRegister" />
            <form v-else class="flex flex-col gap-6" @submit.prevent="saveRegister">
              <fieldset v-for="(g, i) in register" :key="i" class="grid gap-3 rounded-sm border border-default p-4 sm:grid-cols-2">
                <legend class="px-2 text-small font-medium text-highlighted">{{ t('booking.precheckin.guest', { n: i + 1 }) }}</legend>
                <UFormField v-if="savedTravellers.length" :label="t('account.travellers.fillFrom')" class="sm:col-span-2">
                  <USelect
                    :items="savedTravellers.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))"
                    :placeholder="t('account.travellers.choose')"
                    class="w-full"
                    @update:model-value="(v: string) => fillFromSaved(g, v)"
                  />
                </UFormField>
                <UFormField :label="t('booking.checkout.firstName')" required><UInput v-model="g.first_name" autocomplete="off" class="w-full" /></UFormField>
                <UFormField :label="t('booking.checkout.lastName')" required><UInput v-model="g.last_name" autocomplete="off" class="w-full" /></UFormField>
                <UFormField :label="t('booking.precheckin.nationality')"><USelectMenu :model-value="g.nationality ?? undefined" :items="countryItems" value-key="value" class="w-full" @update:model-value="(v: string) => (g.nationality = v)" /></UFormField>
                <UFormField :label="t('booking.precheckin.birthDate')"><UInput :model-value="g.date_of_birth ?? undefined" type="date" class="w-full" @update:model-value="(v: string | number) => (g.date_of_birth = String(v) || null)" /></UFormField>
                <UFormField :label="t('booking.precheckin.docType')"><USelect :model-value="g.id_document_type ?? undefined" :items="docTypes" class="w-full" @update:model-value="(v: RegisterGuest['id_document_type']) => (g.id_document_type = v)" /></UFormField>
                <UFormField v-if="idNumbers" :label="t('booking.precheckin.docNumber')" :help="g.has_id_document ? t('booking.precheckin.docStored') : undefined">
                  <UInput :model-value="g.id_document_number ?? undefined" autocomplete="off" class="w-full" @update:model-value="(v: string | number) => (g.id_document_number = String(v))" />
                </UFormField>
              </fieldset>
              <div class="flex flex-wrap gap-3">
                <UButton type="button" :label="t('booking.precheckin.addGuest')" color="neutral" variant="ghost" icon="i-lucide-plus" @click="register.push({ first_name: '', last_name: '', nationality: null, date_of_birth: null, id_document_type: 'passport', id_document_number: '', is_lead: false })" />
                <UButton type="submit" :label="t('booking.precheckin.save')" :loading="savingRegister" />
              </div>
              <p class="text-caption text-muted">{{ t('booking.precheckin.privacy') }}</p>
            </form>
          </section>

          <!-- Cancel -->
          <section v-if="b.can.cancel" aria-labelledby="cancel-title" class="flex flex-col gap-3 border-t border-default pt-8 print:hidden">
            <h2 id="cancel-title" class="text-h3">{{ t('booking.manage.cancelTitle') }}</h2>
            <p class="text-muted">{{ t('booking.manage.cancelText') }}</p>
            <UButton :label="t('booking.manage.cancelCta')" color="neutral" variant="outline" class="self-start" data-testid="cancel-open" @click="openCancel" />
          </section>
        </div>

        <!-- Practical information -->
        <aside class="flex flex-col gap-6 lg:col-span-5">
          <div class="flex flex-col gap-4 rounded-sm bg-muted p-6">
            <h2 class="text-h3">{{ t('booking.manage.gettingThere') }}</h2>
            <p class="text-small">{{ appConfig.site.address }}</p>
            <p class="text-small text-muted" dir="ltr">GPS {{ lat }}, {{ lng }}</p>
            <p class="text-small text-muted">{{ t('booking.manage.road') }}</p>
            <div class="flex flex-wrap gap-2">
              <UButton :to="googleMaps" target="_blank" icon="i-simple-icons-googlemaps" label="Google Maps" color="neutral" variant="outline" size="sm" />
              <UButton :to="waze" target="_blank" icon="i-simple-icons-waze" label="Waze" color="neutral" variant="outline" size="sm" />
            </div>
            <p v-if="checkIn" class="text-small"><span class="font-medium text-highlighted">{{ t('booking.sections.checkInOut') }}</span> · {{ t('booking.manage.checkInFrom', { time: checkIn }) }}</p>
            <p class="text-small text-muted">{{ t('booking.manage.bring') }}</p>
          </div>
          <div class="flex flex-col gap-3 rounded-sm border border-default p-6">
            <h2 class="text-h3">{{ t('booking.manage.contact') }}</h2>
            <a :href="`mailto:${appConfig.site.email}?subject=${b.reference}`" class="link-underline self-start text-small text-highlighted">{{ appConfig.site.email }}</a>
            <a v-if="appConfig.site.phone" :href="`tel:${appConfig.site.phone}`" class="link-underline self-start text-small text-highlighted" dir="ltr">{{ appConfig.site.phone }}</a>
            <UButton v-if="whatsapp" :to="whatsapp" target="_blank" icon="i-simple-icons-whatsapp" label="WhatsApp" color="neutral" variant="outline" size="sm" class="self-start" />
          </div>
        </aside>
      </div>
    </div>

    <UModal v-model:open="cancelOpen" :title="t('booking.manage.cancelTitle')">
      <template #body>
        <div v-if="preview" class="flex flex-col gap-4" data-testid="cancel-preview">
          <p v-if="!preview.allowed" class="text-error">{{ t(`booking.manage.cancelBlocked.${preview.blocked_reason}`) }}</p>
          <template v-else>
            <p class="text-body-lg">
              <template v-if="preview.paid_minor === 0">{{ t('booking.manage.cancelNothingPaid') }}</template>
              <template v-else-if="preview.refund_minor > 0">{{ t('booking.manage.cancelRefund', { amount: money(preview.refund_minor, b?.currency) }) }}</template>
              <template v-else>{{ t('booking.manage.cancelNoRefund', { amount: money(preview.paid_minor, b?.currency) }) }}</template>
            </p>
            <ul class="flex flex-col gap-1 text-small text-muted">
              <li v-for="i in preview.items.filter(x => x.total_minor > 0)" :key="i.item_id" class="flex justify-between gap-3">
                <span>{{ i.name }}</span>
                <span>{{ t('booking.manage.refundPercent', { n: i.refund_percent }) }}</span>
              </li>
            </ul>
            <UFormField :label="t('booking.manage.cancelReason')" :help="t('common.optional')">
              <UTextarea v-model="reason" :rows="2" class="w-full" />
            </UFormField>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('booking.manage.keep')" color="neutral" variant="ghost" @click="cancelOpen = false" />
          <UButton v-if="preview?.allowed" :label="t('booking.manage.confirmCancel')" color="error" :loading="cancelling" data-testid="cancel-confirm" @click="cancel" />
        </div>
      </template>
    </UModal>
  </MzContainer>
</template>
