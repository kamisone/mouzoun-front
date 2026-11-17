<script setup lang="ts">
import type { Address, FulfillmentMethod, PaymentMethod } from '~/utils/shop-types'
import { type CheckoutForm, newIdempotencyKey, validateCheckout } from '~/utils/shop-checkout'

/**
 * One-page checkout, guest by default: contact, delivery (home / relay point; camp pickup and
 * tent delivery only when the seller offers them), address, shipping option, payment, terms.
 * Every choice re-prices the cart on the server. Before the final button the customer sees a
 * recap (items, delivery, total incl. VAT, seller) and ticks the terms of sale (never pre-ticked;
 * the revision shown is recorded). The button says that ordering obliges to pay (French law).
 * Submitting sends one idempotency key per attempt, then goes to Stripe or the order page.
 */
definePageMeta({ i18n: { paths: { fr: '/boutique/checkout', en: '/shop/checkout', ar: '/boutique/checkout' } } })

const { t } = useI18n()
const api = useShopApi()
const store = useShopCart()
const shopPath = useShopPath()
const localePath = useLocalePath()
const { money } = useMoney()
const { data: config } = await useShopConfig()
if (config.value?.status !== 'open') throw createError({ statusCode: 404, statusMessage: 'Not found' })
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })
useSeo({ title: () => `${t('shop.checkout.title')} · ${t('common.siteName')}`, description: () => t('shop.description') })
onMounted(() => store.load())
const cart = store.cart

const emptyAddress = (): Address => ({ first_name: '', last_name: '', line1: '', line2: '', city: '', region: '', postal_code: '', country_code: config.value?.ships_to_countries[0] ?? 'FR', phone: '', delivery_notes: '' })
const form = reactive<CheckoutForm>({
  email: '', phone: '', first_name: '', last_name: '',
  method: undefined, address: emptyAddress(), pickup_location_id: config.value?.pickup_points[0]?.id,
  booking_reference: '', booking_last_name: '', payment_method: undefined, accept_terms: false,
})
const marketing = ref(false)
const note = ref('')
const errors = ref<Record<string, string>>({})
const serverError = ref<string | null>(null)
const submitting = ref(false)
let attemptKey = newIdempotencyKey()

watch(cart, (c) => {
  if (!c) return
  if (!form.method && c.fulfillment_method) form.method = c.fulfillment_method
  if (c.shipping_address && !form.address.line1) Object.assign(form.address, c.shipping_address)
  if (c.relay_point && !form.relay_point_id) form.relay_point_id = c.relay_point.id
  if (!form.email && c.email) form.email = c.email
}, { immediate: true })

const offered = computed(() => config.value?.fulfillment_methods ?? ['shipping'])
const methods = computed(() => [
  { value: 'shipping', label: t('shop.checkout.fulfillment.shipping') },
  ...(offered.value.includes('relay_point') ? [{ value: 'relay_point', label: t('shop.checkout.fulfillment.relay_point'), description: t('shop.checkout.fulfillment.relayHint') }] : []),
  ...(offered.value.includes('pickup') && config.value?.pickup_points.length ? [{ value: 'pickup', label: t('shop.checkout.fulfillment.pickup') }] : []),
  ...(offered.value.includes('stay_delivery') && config.value?.stay_delivery_enabled ? [{ value: 'stay_delivery', label: t('shop.checkout.fulfillment.stay_delivery'), description: t('shop.checkout.fulfillment.stayHint') }] : []),
])
const ships = computed(() => form.method === 'shipping' || form.method === 'relay_point')
const termsPath = computed(() => config.value?.legal_pages.cgv ? localePath(`/${config.value.legal_pages.cgv}`) : localePath('/legal/terms'))
const withdrawalPath = computed(() => config.value?.legal_pages.withdrawal ? localePath(`/${config.value.legal_pages.withdrawal}`) : null)
const buttonLabel = computed(() => config.value?.checkout_button_label || t('shop.checkout.obligationButton'))
const deliveryRecap = computed(() => {
  if (form.method === 'relay_point' && cart.value?.relay_point) return `${t('shop.checkout.fulfillment.relay_point')} · ${cart.value.relay_point.name}, ${cart.value.relay_point.city}`
  if (form.method === 'shipping' && form.address.line1) return `${t('shop.checkout.fulfillment.shipping')} · ${form.address.line1}, ${form.address.postal_code ?? ''} ${form.address.city}`
  return form.method ? t(`shop.checkout.fulfillment.${form.method}`) : ''
})
const payments = computed(() => (cart.value?.payment_methods ?? []).map((m: PaymentMethod) => ({
  value: m,
  label: t(`shop.checkout.payment.${m}`),
  description: t(`shop.checkout.payment.${m}Hint`, { fee: money(Math.max(0, ...(cart.value?.shipping_lines ?? []).map(l => l.cod_fee_minor)), cart.value?.currency) }),
})))
watch(payments, (p) => { if (form.payment_method && !p.some(x => x.value === form.payment_method)) form.payment_method = undefined })

/** Sends the delivery choice; the cart comes back re-priced (shipping options, COD...). */
async function saveFulfillment() {
  if (!form.method) return
  serverError.value = null
  try {
    await store.fulfillment({
      method: form.method as FulfillmentMethod,
      shipping_address: ships.value ? form.address : null,
      relay_point_id: form.method === 'relay_point' ? form.relay_point_id ?? null : null,
      pickup_location_id: form.method === 'pickup' ? form.pickup_location_id ?? null : null,
      booking_reference: form.method === 'stay_delivery' ? form.booking_reference : null,
      last_name: form.method === 'stay_delivery' ? form.booking_last_name : null,
      shipping_rate_ids: chosenRates.value,
      email: form.email || null,
    })
  }
  catch (e) {
    applyServerErrors(e)
    throw e
  }
}
watch(() => form.method, (m) => {
  if (m === 'pickup') saveFulfillment().catch(() => {})
})
watch(() => form.relay_point_id, (id) => {
  if (id && form.method === 'relay_point' && form.address.line1) saveFulfillment().catch(() => {})
})
const chosenRates = ref<string[]>([])
function chooseRate(profile: string, rate: string) {
  const others = (cart.value?.shipping_lines ?? []).filter(l => l.profile_id !== profile).map(l => l.rate_id).filter(Boolean) as string[]
  chosenRates.value = [...others, rate]
  saveFulfillment().catch(() => {})
}

function applyServerErrors(e: unknown) {
  const err = (e as { data?: { error?: { code?: string, details?: { fields?: Record<string, string> } } } }).data?.error
  const fields = err?.details?.fields
  if (fields) {
    for (const [k, v] of Object.entries(fields)) errors.value[k in form.address && ships.value ? `address.${k}` : k] = v
  }
  serverError.value = apiErrorMessage(e, t)
}

function message(code: string) {
  return code === 'required' ? t('shop.checkout.required') : code === 'not_shipped' ? t('shop.checkout.notShipped') : t('shop.checkout.invalid')
}
const addressErrors = computed(() => Object.fromEntries(Object.entries(errors.value).filter(([k]) => k.startsWith('address.')).map(([k, v]) => [k.slice(8), message(v)])))

async function focusFirstError() {
  await nextTick()
  const el = document.querySelector<HTMLElement>('[aria-invalid="true"]')
  el?.focus()
}

async function submit() {
  errors.value = validateCheckout(form, config.value?.ships_to_countries ?? [])
  serverError.value = null
  if (Object.keys(errors.value).length) {
    serverError.value = t('shop.checkout.fixErrors')
    return focusFirstError()
  }
  submitting.value = true
  try {
    if (form.method !== 'pickup') await saveFulfillment()
    const result = await api.checkout({
      payment_method: form.payment_method!,
      email: form.email.trim(),
      phone: form.phone || form.address.phone || null,
      first_name: ships.value ? form.address.first_name : form.first_name,
      last_name: ships.value ? form.address.last_name : form.last_name,
      accept_terms: form.accept_terms,
      terms_revision_id: config.value?.terms_revision_id ?? null,
      marketing_consent: marketing.value,
      customer_note: note.value || null,
    }, attemptKey)
    store.cart.value = null
    if (result.order.redirect_url) {
      window.location.assign(result.order.redirect_url)
      return
    }
    await navigateTo(shopPath(`orders/${result.order.number}?t=${result.access_token}`))
  }
  catch (e) {
    applyServerErrors(e)
    // A refused attempt (issues, payment) can be retried with a new key after changes.
    attemptKey = newIdempotencyKey()
    focusFirstError()
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-12 pt-24">
    <MzPageHeader :title="t('shop.checkout.title')" />
    <MzEmptyState v-if="cart && !cart.items.length" icon="i-lucide-shopping-basket" :title="t('shop.cart.empty')" description="">
      <UButton :to="shopPath()" :label="t('shop.cart.continue')" />
    </MzEmptyState>
    <form v-else class="grid gap-12 lg:grid-cols-[1fr_24rem]" novalidate data-testid="checkout-form" @submit.prevent="submit">
      <div class="flex flex-col gap-12">
        <p v-if="serverError" class="rounded-md bg-error/10 p-3 text-body text-error" role="alert" data-testid="checkout-error">{{ serverError }}</p>

        <section class="flex flex-col gap-4" aria-labelledby="contact-title">
          <h2 id="contact-title" class="font-display text-h3 text-highlighted">{{ t('shop.checkout.contact') }}</h2>
          <UFormField :label="t('shop.checkout.email')" name="email" required :error="errors.email && message(errors.email)">
            <UInput v-model="form.email" type="email" autocomplete="email" class="w-full" :aria-invalid="!!errors.email" data-testid="checkout-email" />
          </UFormField>
          <div v-if="!ships" class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('shop.checkout.firstName')" name="first_name" required :error="errors.first_name && message(errors.first_name)">
              <UInput v-model="form.first_name" autocomplete="given-name" class="w-full" :aria-invalid="!!errors.first_name" />
            </UFormField>
            <UFormField :label="t('shop.checkout.lastName')" name="last_name">
              <UInput v-model="form.last_name" autocomplete="family-name" class="w-full" />
            </UFormField>
          </div>
          <UFormField v-if="!ships" :label="t('shop.checkout.phone')" name="phone" :error="errors.phone && message(errors.phone)">
            <UInput v-model="form.phone" type="tel" autocomplete="tel" dir="ltr" class="w-full" :aria-invalid="!!errors.phone" />
          </UFormField>
        </section>

        <section class="flex flex-col gap-4" aria-labelledby="delivery-title">
          <h2 id="delivery-title" class="font-display text-h3 text-highlighted">{{ t('shop.checkout.fulfillment.title') }}</h2>
          <URadioGroup v-model="form.method" :items="methods" variant="card" :aria-invalid="!!errors.method" data-testid="checkout-method" />
          <p v-if="errors.method" class="text-small text-error">{{ message(errors.method) }}</p>
          <template v-if="ships">
            <p v-if="form.method === 'relay_point'" class="text-small text-muted">{{ t('shop.checkout.relay.addressHint') }}</p>
            <MzAddressForm v-model="form.address" :countries="config?.ships_to_countries ?? []" :errors="addressErrors" />
            <MzRelayPicker v-if="form.method === 'relay_point'" v-model="form.relay_point_id" :postal-code="form.address.postal_code" :selected="cart?.relay_point" :error="errors.relay_point_id && message(errors.relay_point_id)" />
            <UButton :label="t('shop.checkout.address.save')" color="neutral" variant="outline" class="self-start" @click="saveFulfillment().catch(() => {})" />
          </template>
          <UFormField v-else-if="form.method === 'pickup' && (config?.pickup_points.length ?? 0) > 1" :label="t('shop.checkout.fulfillment.pickupPoint')" name="pickup">
            <USelect v-model="form.pickup_location_id" :items="config!.pickup_points.map(p => ({ value: p.id, label: p.name }))" class="w-full" @update:model-value="saveFulfillment().catch(() => {})" />
          </UFormField>
          <p v-if="form.method === 'pickup' && config?.pickup_points[0]?.instructions" class="text-small text-muted">{{ config.pickup_points.find(p => p.id === form.pickup_location_id)?.instructions }}</p>
          <div v-else-if="form.method === 'stay_delivery'" class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('shop.checkout.fulfillment.bookingReference')" name="booking_reference" required :error="errors.booking_reference && message(errors.booking_reference)">
              <UInput v-model="form.booking_reference" dir="ltr" class="w-full" placeholder="MZ-27-000123" :aria-invalid="!!errors.booking_reference" />
            </UFormField>
            <UFormField :label="t('shop.checkout.fulfillment.lastName')" name="booking_last_name" required :error="errors.booking_last_name && message(errors.booking_last_name)">
              <UInput v-model="form.booking_last_name" autocomplete="family-name" class="w-full" :aria-invalid="!!errors.booking_last_name" />
            </UFormField>
            <UButton :label="t('shop.checkout.fulfillment.verify')" color="neutral" variant="outline" class="self-start" @click="saveFulfillment().catch(() => {})" />
            <p v-if="cart?.stay_booking" class="text-small text-success sm:col-span-2" role="status">{{ t('shop.checkout.fulfillment.verified') }}</p>
          </div>

          <fieldset v-if="cart?.shipping_lines.some(l => l.options.length > 1)" class="flex flex-col gap-3">
            <legend class="mb-2 font-medium text-highlighted">{{ t('shop.checkout.shippingOptions') }}</legend>
            <div v-for="line in cart.shipping_lines" :key="line.profile_id" class="flex flex-col gap-2">
              <label v-for="o in line.options" :key="o.rate_id" class="flex items-center justify-between gap-3 rounded-md border border-default p-3">
                <span class="flex items-center gap-2">
                  <input type="radio" :name="`rate-${line.profile_id}`" :checked="line.rate_id === o.rate_id" @change="chooseRate(line.profile_id, o.rate_id)">
                  {{ o.name }}<span v-if="o.delivery_days_min !== null" class="text-small text-muted">· {{ t('shop.checkout.days', { min: o.delivery_days_min, max: o.delivery_days_max ?? o.delivery_days_min }) }}</span>
                </span>
                <span class="tabular-nums">{{ o.amount_minor ? money(o.amount_minor, cart.currency) : t('shop.cart.shippingFree') }}</span>
              </label>
            </div>
          </fieldset>
        </section>

        <section class="flex flex-col gap-4" aria-labelledby="payment-title">
          <h2 id="payment-title" class="font-display text-h3 text-highlighted">{{ t('shop.checkout.payment.title') }}</h2>
          <URadioGroup v-model="form.payment_method" :items="payments" variant="card" :aria-invalid="!!errors.payment_method" data-testid="checkout-payment" />
          <p v-if="errors.payment_method" class="text-small text-error">{{ message(errors.payment_method) }}</p>
          <UFormField :label="t('shop.checkout.note')" name="note">
            <UTextarea v-model="note" :rows="2" class="w-full" />
          </UFormField>
        </section>
      </div>

      <aside class="flex flex-col gap-6 self-start rounded-md border border-default p-6 lg:sticky lg:top-24" :aria-label="t('shop.checkout.summary')">
        <h2 class="font-display text-h3 text-highlighted">{{ t('shop.checkout.summary') }}</h2>
        <template v-if="cart">
          <MzCartLines :cart="cart" :editable="false" compact />
          <MzShopIssue v-for="(issue, i) in cart.issues.filter(x => x.code !== 'fulfillment_required')" :key="i" :issue="issue" :currency="cart.currency" />
          <MzCartSummary :cart="{ ...cart, shipping_known: !!cart.fulfillment_method }" />
          <!-- Recap right before ordering: what, where, how much, from whom (L221-14). -->
          <dl class="flex flex-col gap-1 border-t border-default pt-4 text-small" data-testid="checkout-recap">
            <div v-if="deliveryRecap" class="flex flex-col"><dt class="text-muted">{{ t('shop.checkout.recap.delivery') }}</dt><dd>{{ deliveryRecap }}</dd></div>
            <div v-if="form.payment_method" class="flex flex-col"><dt class="text-muted">{{ t('shop.checkout.recap.payment') }}</dt><dd>{{ t(`shop.checkout.payment.${form.payment_method}`) }}</dd></div>
            <div class="flex flex-col"><dt class="text-muted">{{ t('shop.checkout.recap.total') }}</dt><dd class="font-semibold text-highlighted">{{ money(cart.totals.total_minor, cart.currency) }} {{ t('shop.checkout.recap.ttc') }}</dd></div>
            <div v-if="config?.seller" class="flex flex-col"><dt class="text-muted">{{ t('shop.checkout.recap.seller') }}</dt><dd>{{ config.seller.legal_name }}</dd></div>
            <dd class="text-muted">
              {{ t('shop.checkout.recap.withdrawal', { days: config?.withdrawal_days ?? 14 }) }}
              <NuxtLink v-if="withdrawalPath" :to="withdrawalPath" target="_blank" class="underline">{{ t('shop.checkout.recap.withdrawalLink') }}</NuxtLink>
            </dd>
          </dl>
          <UCheckbox v-model="form.accept_terms" name="accept_terms" required :aria-invalid="!!errors.accept_terms" data-testid="checkout-terms">
            <template #label>
              <i18n-t keypath="shop.checkout.terms" tag="span">
                <template #link><NuxtLink :to="termsPath" target="_blank" class="underline">{{ t('shop.checkout.termsLink') }}</NuxtLink></template>
              </i18n-t>
            </template>
          </UCheckbox>
          <p v-if="errors.accept_terms" class="text-small text-error">{{ message(errors.accept_terms) }}</p>
          <UCheckbox v-model="marketing" :label="t('shop.checkout.marketing')" name="marketing" data-testid="checkout-marketing" />
          <UButton type="submit" size="xl" block :loading="submitting" :label="submitting ? t('shop.checkout.submitting') : buttonLabel" data-testid="place-order" />
        </template>
      </aside>
    </form>
  </MzContainer>
</template>
