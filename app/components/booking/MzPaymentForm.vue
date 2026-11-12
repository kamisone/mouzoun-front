<script setup lang="ts">
import type { BookingConfig, StartedPayment } from '~/utils/booking-types'
import { stripeAppearance } from '~/theme/stripe'

/**
 * Card / Apple Pay / Google Pay through Stripe's Payment Element (3-D Secure handled by
 * Stripe). Card data never touches Mouzoun (PCI SAQ A). Stripe.js is loaded only here, on the
 * payment step. On a decline the guest stays on the page with the provider's message and can
 * try another card; the hold is kept. In development the fake provider shows two buttons.
 */
interface StripeLike {
  elements: (o: Record<string, unknown>) => { create: (type: string, o?: Record<string, unknown>) => { mount: (el: HTMLElement) => void, on: (e: string, cb: (ev: { complete?: boolean }) => void) => void } }
  confirmPayment: (o: Record<string, unknown>) => Promise<{ error?: { message?: string }, paymentIntent?: { status: string } }>
}

const props = defineProps<{
  payment: StartedPayment
  config: BookingConfig['payments']
  returnUrl: string
  cta: string
}>()
const emit = defineEmits<{ paid: [], failed: [message: string] }>()
const { t, locale } = useI18n()
const api = useBookingApi()
const colorMode = useColorMode()

const mount = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const ready = ref(false)
let stripe: StripeLike | null = null
let elements: ReturnType<StripeLike['elements']> | null = null

function loadStripe(): Promise<(key: string, o: Record<string, unknown>) => StripeLike> {
  const w = window as unknown as { Stripe?: (key: string, o: Record<string, unknown>) => StripeLike }
  if (w.Stripe) return Promise.resolve(w.Stripe)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.async = true
    s.onload = () => (w.Stripe ? resolve(w.Stripe) : reject(new Error('stripe')))
    s.onerror = () => reject(new Error('stripe'))
    document.head.appendChild(s)
  })
}

onMounted(async () => {
  if (props.payment.provider !== 'stripe') {
    ready.value = true
    return
  }
  try {
    const Stripe = await loadStripe()
    const key = props.config.stripe?.publishable_key
    if (!key) throw new Error('no key')
    stripe = Stripe(key, { locale: locale.value === 'ar' ? 'ar' : locale.value })
    elements = stripe.elements({ clientSecret: props.payment.client_secret, appearance: stripeAppearance(colorMode.value === 'dark') })
    const element = elements.create('payment', { layout: 'tabs' })
    element.mount(mount.value!)
    ready.value = true
  }
  catch {
    error.value = t('booking.pay.providerUnavailable')
  }
})

async function pay() {
  error.value = null
  busy.value = true
  try {
    if (props.payment.provider === 'fake') {
      await api.fakePayment(props.payment.payment_id, 'succeed')
      emit('paid')
      return
    }
    if (!stripe || !elements) return
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: props.returnUrl }, redirect: 'if_required' })
    if (result.error) {
      error.value = result.error.message ?? t('booking.pay.declined')
      emit('failed', error.value)
    }
    else {
      emit('paid')
    }
  }
  catch {
    error.value = t('booking.pay.declined')
  }
  finally {
    busy.value = false
  }
}

async function decline() {
  await api.fakePayment(props.payment.payment_id, 'fail').catch(() => null)
  error.value = t('booking.pay.declined')
  emit('failed', error.value)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="props.payment.provider === 'stripe'" ref="mount" class="min-h-40" />
    <UAlert
      v-else-if="props.payment.provider === 'fake'"
      color="warning"
      variant="subtle"
      icon="i-lucide-flask-conical"
      :title="t('booking.pay.fakeTitle')"
      :description="t('booking.pay.fakeText')"
    />
    <p v-if="error" role="alert" class="text-small text-error" data-testid="payment-error">{{ error }}</p>
    <UButton :label="props.cta" :loading="busy" :disabled="!ready" size="xl" block icon="i-lucide-lock" data-testid="pay-button" @click="pay" />
    <button v-if="props.payment.provider === 'fake'" type="button" class="link-underline self-center text-small text-muted" @click="decline">
      {{ t('booking.pay.fakeDecline') }}
    </button>
    <p class="flex items-center justify-center gap-2 text-caption text-muted">
      <UIcon name="i-lucide-shield-check" class="size-4" aria-hidden="true" />
      {{ t('booking.pay.secure') }}
    </p>
  </div>
</template>
