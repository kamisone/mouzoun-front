<script setup lang="ts">
import type { PaymentOption } from '~/utils/booking-types'
import { DIAL_CODES, countries, defaultCountry, isEmail, suggestEmail } from '~/utils/contact'

/**
 * One-page checkout, guest checkout by default: 1. Your details, 2. Payment option, 3. Review
 * and pay — with the trip summary sticky beside it. Inline validation on blur, plain-word
 * errors, nothing is cleared on error, and the form survives a reload (sessionStorage).
 * The button states the action and the amount. Clicking it holds the inventory.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()
const api = useBookingApi()
const trip = useTrip()
const access = useBookingAccess()
const { money } = useMoney()
const { date } = useDate()
const { track } = useAnalytics()
const { data: config } = useBookingConfig()
const runtime = useRuntimeConfig()

useSeo({ title: () => `${t('booking.checkout.title')} · ${t('common.siteName')}`, description: () => t('booking.trip.description') })
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })

await useAsyncData('checkout-cart', () => trip.refresh())
const quote = computed(() => trip.cart.value?.quote ?? null)
if (import.meta.client && !trip.cart.value?.items.length) await navigateTo(localePath('/trip'))

const STORAGE = 'mz-checkout-form'
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  country_code: defaultCountry(locale.value),
  dial: DIAL_CODES[defaultCountry(locale.value)] ?? '+212',
  phone: '',
  whatsapp_preferred: true,
  estimated_arrival_time: undefined as string | undefined,
  special_requests: '',
  payment_option: null as PaymentOption | null,
  save_card: false,
  accept_terms: false,
  marketing_consent: false,
})
onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null') as Partial<typeof form> | null
    if (saved) Object.assign(form, { ...saved, accept_terms: false })
  }
  catch { /* nothing saved */ }
})
watchDebounced(form, () => {
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(form))
  }
  catch { /* private mode */ }
}, { debounce: 400, deep: true })

const options = computed(() => quote.value?.payment_options ?? [])
watchEffect(() => {
  if (!form.payment_option || !options.value.some(o => o.option === form.payment_option)) {
    form.payment_option = options.value.find(o => o.option === 'deposit')?.option ?? options.value[0]?.option ?? null
  }
})
const choice = computed(() => options.value.find(o => o.option === form.payment_option) ?? null)

// Validation on blur.
const touched = reactive<Record<string, boolean>>({})
const errors = computed(() => ({
  first_name: !form.first_name.trim() ? t('booking.checkout.errors.required') : null,
  last_name: !form.last_name.trim() ? t('booking.checkout.errors.required') : null,
  email: !isEmail(form.email) ? t('booking.checkout.errors.email') : null,
  phone: form.phone && form.phone.replace(/\D/g, '').length < 6 ? t('booking.checkout.errors.phone') : null,
  accept_terms: !form.accept_terms ? t('booking.checkout.errors.terms') : null,
}))
const show = (field: keyof typeof errors.value) => (touched[field] ? errors.value[field] ?? undefined : undefined)
const emailSuggestion = computed(() => (form.email ? suggestEmail(form.email) : null))
const countryItems = computed(() => countries(locale.value))
const dialItems = computed(() => Object.entries(DIAL_CODES).map(([cc, dial]) => ({ label: `${cc} ${dial}`, value: dial })).filter((x, i, a) => a.findIndex(y => y.value === x.value) === i))
watch(() => form.country_code, (cc) => {
  if (!form.phone && DIAL_CODES[cc]) form.dial = DIAL_CODES[cc]
})
const arrivalTimes = computed(() => {
  const out: string[] = []
  for (let m = 12 * 60; m <= 23 * 60; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return out
})
const hasStay = computed(() => quote.value?.items.some(i => i.kind === 'accommodation') ?? false)

const cta = computed(() => {
  if (quote.value?.is_request) return t('booking.checkout.ctaRequest')
  if (!choice.value || choice.value.due_now_minor === 0) return t('booking.checkout.ctaOnSite')
  return t('booking.checkout.ctaPay', { amount: money(choice.value.due_now_minor, quote.value?.currency) })
})

const submitting = ref(false)
const problem = ref<string | null>(null)
const errorSummary = ref<HTMLElement | null>(null)
let attemptKey: string | null = null

async function captchaToken(): Promise<string | null> {
  const siteKey = runtime.public.turnstileSiteKey as string | undefined
  if (!config.value?.captcha || !siteKey) return null
  const w = window as unknown as { turnstile?: { execute: (el: string, o: Record<string, unknown>) => void, render: (el: string, o: Record<string, unknown>) => string } }
  if (!w.turnstile) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('captcha'))
      document.head.appendChild(s)
    })
  }
  return new Promise((resolve) => {
    w.turnstile!.render('#captcha', { sitekey: siteKey, size: 'invisible', callback: (tk: string) => resolve(tk), 'error-callback': () => resolve(null) })
  })
}

async function submit() {
  Object.keys(errors.value).forEach((k) => { touched[k] = true })
  if (Object.values(errors.value).some(Boolean) || !quote.value || !trip.cart.value?.quote_token || !form.payment_option) {
    problem.value = t('booking.checkout.errors.summary')
    await nextTick()
    errorSummary.value?.focus()
    return
  }
  problem.value = null
  submitting.value = true
  attemptKey ??= crypto.randomUUID()
  try {
    // "Try again" after an expired hold puts these items back in the basket.
    sessionStorage.setItem('mz-last-basket', JSON.stringify(trip.cart.value.items))
  }
  catch { /* private mode */ }
  try {
    track('add_payment_info', { payment_type: form.payment_option, value: quote.value.total_minor / 100, currency: 'EUR' })
    const res = await api.checkout({
      quote_token: trip.cart.value.quote_token,
      customer: {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone ? `${form.dial} ${form.phone.trim()}` : undefined,
        country_code: form.country_code,
        whatsapp_preferred: form.whatsapp_preferred && !!form.phone,
      },
      payment_option: form.payment_option,
      save_card: form.save_card,
      estimated_arrival_time: form.estimated_arrival_time ?? null,
      special_requests: form.special_requests || null,
      accept_terms: form.accept_terms,
      marketing_consent: form.marketing_consent,
      captcha_token: await captchaToken(),
    }, attemptKey)
    access.remember(res.booking.reference, res.access_token)
    try {
      sessionStorage.removeItem(STORAGE)
    }
    catch { /* nothing to clear */ }
    trip.cart.value = null
    const query = { t: res.access_token }
    if (res.payment) {
      sessionStorage.setItem(`mz-payment-${res.booking.reference}`, JSON.stringify({ payment: res.payment, config: res.payment_config, hold: res.booking.hold_expires_at, total: res.booking.total_minor }))
      await navigateTo({ path: localePath(`/booking/${res.booking.reference}/pay`), query })
    }
    else {
      await navigateTo({ path: localePath(`/booking/${res.booking.reference}`), query: { ...query, new: '1' } })
    }
  }
  catch (e) {
    const code = apiErrorCode(e)
    attemptKey = null
    if (code === 'price_changed' || code === 'quote_expired' || code === 'not_available' || code === 'promo_invalid') {
      const before = quote.value?.total_minor ?? 0
      await trip.refresh()
      problem.value = code === 'price_changed' || code === 'quote_expired'
        ? t('booking.checkout.priceChanged', { old: money(before), new: money(trip.cart.value?.quote?.total_minor ?? 0) })
        : t(`booking.errors.${code}`)
    }
    else {
      problem.value = t(`booking.errors.${code}`, t('booking.errors.generic'))
    }
    await nextTick()
    errorSummary.value?.focus()
  }
  finally {
    submitting.value = false
  }
}
const optionLabel = (o: PaymentOption) => t(`booking.checkout.options.${o}`)
</script>

<template>
  <MzContainer class="pt-12 pb-24 lg:pt-16">
    <header class="flex flex-col gap-3 pb-8">
      <NuxtLink :to="localePath('/trip')" class="link-underline self-start text-small text-muted">← {{ t('booking.checkout.back') }}</NuxtLink>
      <h1 class="text-display-lg">{{ t('booking.checkout.title') }}</h1>
      <p class="text-muted">{{ t('booking.checkout.guestCheckout') }}</p>
    </header>

    <div v-if="quote" class="grid gap-12 lg:grid-cols-12">
      <form class="flex flex-col gap-12 lg:col-span-7" novalidate data-testid="checkout-form" @submit.prevent="submit">
        <div v-if="problem" ref="errorSummary" tabindex="-1" role="alert" class="rounded-sm border border-error p-4 text-small text-error" data-testid="checkout-problem">
          {{ problem }}
          <NuxtLink v-if="trip.cart.value?.quote?.has_issues" :to="localePath('/trip')" class="link-underline ms-2 font-medium">{{ t('booking.checkout.reviewTrip') }}</NuxtLink>
        </div>

        <!-- 1. Your details -->
        <section class="flex flex-col gap-6" aria-labelledby="step-details">
          <h2 id="step-details" class="text-h2"><span class="text-muted">1.</span> {{ t('booking.checkout.details') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('booking.checkout.firstName')" :error="show('first_name')" required>
              <UInput v-model="form.first_name" autocomplete="given-name" class="w-full" @blur="touched.first_name = true" />
            </UFormField>
            <UFormField :label="t('booking.checkout.lastName')" :error="show('last_name')" required>
              <UInput v-model="form.last_name" autocomplete="family-name" class="w-full" @blur="touched.last_name = true" />
            </UFormField>
            <UFormField :label="t('booking.checkout.email')" :error="show('email')" :help="t('booking.checkout.emailHelp')" required class="sm:col-span-2">
              <UInput v-model="form.email" type="email" autocomplete="email" inputmode="email" class="w-full" @blur="touched.email = true" />
              <template v-if="emailSuggestion" #hint>
                <button type="button" class="link-underline text-small text-highlighted" @click="form.email = emailSuggestion!">
                  {{ t('booking.checkout.didYouMean', { email: emailSuggestion }) }}
                </button>
              </template>
            </UFormField>
            <UFormField :label="t('booking.checkout.country')">
              <USelectMenu v-model="form.country_code" :items="countryItems" value-key="value" autocomplete="country" class="w-full" />
            </UFormField>
            <UFormField :label="t('booking.checkout.phone')" :error="show('phone')">
              <div class="flex gap-2">
                <USelect v-model="form.dial" :items="dialItems" :aria-label="t('booking.checkout.dialCode')" class="w-32" />
                <UInput v-model="form.phone" type="tel" autocomplete="tel-national" inputmode="tel" class="flex-1" @blur="touched.phone = true" />
              </div>
            </UFormField>
            <UCheckbox v-model="form.whatsapp_preferred" :label="t('booking.checkout.whatsapp')" class="sm:col-span-2" />
            <UFormField v-if="hasStay" :label="t('booking.checkout.arrivalTime')" :help="t('booking.checkout.arrivalTimeHelp')">
              <USelect v-model="form.estimated_arrival_time" :items="arrivalTimes" :placeholder="t('booking.checkout.arrivalTimeUnknown')" class="w-full" />
            </UFormField>
            <UFormField :label="t('booking.checkout.requests')" :help="t('booking.checkout.requestsHelp')" class="sm:col-span-2">
              <UTextarea v-model="form.special_requests" :rows="3" :maxlength="2000" class="w-full" />
            </UFormField>
          </div>
        </section>

        <!-- 2. Payment option -->
        <section class="flex flex-col gap-6" aria-labelledby="step-payment">
          <h2 id="step-payment" class="text-h2"><span class="text-muted">2.</span> {{ t('booking.checkout.payment') }}</h2>
          <p v-if="quote.is_request" class="text-muted">{{ t('booking.checkout.requestNote', { hours: config?.request_answer_hours ?? 24 }) }}</p>
          <fieldset class="flex flex-col gap-3">
            <legend class="sr-only">{{ t('booking.checkout.payment') }}</legend>
            <label
              v-for="o in options"
              :key="o.option"
              class="flex cursor-pointer items-start gap-4 rounded-sm border p-4"
              :class="form.payment_option === o.option ? 'border-primary bg-elevated' : 'border-default'"
            >
              <input v-model="form.payment_option" type="radio" name="payment_option" :value="o.option" class="mt-1 accent-(--ui-primary)" :data-testid="`option-${o.option}`">
              <span class="flex flex-1 flex-col gap-1">
                <span class="font-medium text-highlighted">{{ optionLabel(o.option) }}</span>
                <span class="text-small text-muted">
                  <template v-if="o.option === 'deposit'">{{ t('booking.checkout.depositDetail', { now: money(o.due_now_minor), later: money(o.due_later_minor), date: o.due_later_on ? date(o.due_later_on) : '' }) }}</template>
                  <template v-else-if="o.option === 'full'">{{ t('booking.checkout.fullDetail', { amount: money(o.due_now_minor) }) }}</template>
                  <template v-else>{{ t('booking.checkout.onSiteDetail', { amount: money(o.due_later_minor) }) }}</template>
                </span>
              </span>
            </label>
          </fieldset>
          <UCheckbox
            v-if="form.payment_option === 'deposit' && config?.balance_auto_charge"
            v-model="form.save_card"
            :label="t('booking.checkout.saveCard')"
            :description="t('booking.checkout.saveCardHelp', { date: choice?.due_later_on ? date(choice.due_later_on) : '' })"
          />
        </section>

        <!-- 3. Review and pay -->
        <section class="flex flex-col gap-6" aria-labelledby="step-review">
          <h2 id="step-review" class="text-h2"><span class="text-muted">3.</span> {{ t('booking.checkout.review') }}</h2>
          <div class="flex flex-col gap-3 rounded-sm bg-muted p-6">
            <h3 class="eyebrow">{{ t('booking.checkout.cancellation') }}</h3>
            <MzCancellationSummary :steps="quote.cancellation" />
            <p class="text-caption text-muted">{{ t('booking.checkout.campTime') }}</p>
          </div>
          <div class="flex flex-col gap-2 text-small">
            <h3 class="eyebrow">{{ t('booking.checkout.rules') }}</h3>
            <p class="text-muted">{{ t('booking.checkout.rulesText') }}</p>
          </div>
          <UCheckbox v-model="form.accept_terms" required :error="!!show('accept_terms')" data-testid="accept-terms" @update:model-value="touched.accept_terms = true">
            <template #label>
              <i18n-t keypath="booking.checkout.acceptTerms" tag="span">
                <template #terms><NuxtLink :to="localePath('/legal/terms')" target="_blank" class="link-underline text-highlighted">{{ t('booking.checkout.terms') }}</NuxtLink></template>
                <template #privacy><NuxtLink :to="localePath('/legal/privacy')" target="_blank" class="link-underline text-highlighted">{{ t('booking.checkout.privacy') }}</NuxtLink></template>
              </i18n-t>
            </template>
          </UCheckbox>
          <p v-if="show('accept_terms')" class="text-small text-error">{{ show('accept_terms') }}</p>
          <UCheckbox v-model="form.marketing_consent" :label="t('booking.checkout.marketing')" />
          <p class="text-caption text-muted">{{ t('booking.checkout.privacyNote') }}</p>
          <div id="captcha" />
          <UButton type="submit" :label="cta" :loading="submitting" size="xl" block data-testid="checkout-submit" />
          <p v-if="choice && choice.due_now_minor === 0 && !quote.is_request" class="text-center text-small text-muted">{{ t('booking.rate.notChargedYet') }}</p>
          <p class="flex items-center justify-center gap-2 text-caption text-muted">
            <UIcon name="i-lucide-lock" class="size-4" aria-hidden="true" />{{ t('booking.pay.secure') }}
          </p>
        </section>
      </form>

      <div class="lg:col-span-5">
        <div class="sticky top-24">
          <MzTripSummary :quote="quote" :payment-option="form.payment_option" />
        </div>
      </div>
    </div>
  </MzContainer>
</template>
