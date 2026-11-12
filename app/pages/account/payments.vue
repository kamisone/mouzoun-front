<script setup lang="ts">
import type { SavedCard } from '~/utils/account-types'
import { stripeAppearance } from '~/theme/stripe'

/**
 * Payment methods. Cards are kept by Stripe, never by Mouzoun: we only see the brand, the last
 * four digits and the expiry. A card paying the balance of an upcoming stay cannot be removed.
 */
definePageMeta({ middleware: 'account' })
interface StripeLike {
  elements: (o: Record<string, unknown>) => { create: (type: string, o?: Record<string, unknown>) => { mount: (el: HTMLElement) => void } }
  confirmSetup: (o: Record<string, unknown>) => Promise<{ error?: { message?: string } }>
}
const { t, locale } = useI18n()
const api = useAccountApi()
const toast = useToast()
const colorMode = useColorMode()
const route = useRoute()

const cards = ref<SavedCard[]>([])
const loading = ref(true)
const failed = ref(false)
async function load() {
  loading.value = true
  failed.value = false
  try {
    cards.value = (await api.cards.list()).cards
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

const adding = ref(false)
const mount = ref<HTMLElement | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const fake = ref(false)
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

async function startAdding() {
  error.value = null
  busy.value = true
  try {
    const setup = await api.cards.setup()
    const key = (setup.provider.stripe as { publishable_key?: string } | undefined)?.publishable_key
    fake.value = !key
    adding.value = true
    if (key) {
      await nextTick()
      const Stripe = await loadStripe()
      stripe = Stripe(key, { locale: locale.value })
      elements = stripe.elements({ clientSecret: setup.client_secret, appearance: stripeAppearance(colorMode.value === 'dark') })
      elements.create('payment', { layout: 'tabs' }).mount(mount.value!)
    }
  }
  catch (e) {
    error.value = t(`account.errors.${apiErrorCode(e)}`, t('booking.pay.providerUnavailable'))
  }
  finally {
    busy.value = false
  }
}

async function confirm() {
  busy.value = true
  error.value = null
  try {
    if (stripe && elements) {
      const res = await stripe.confirmSetup({ elements, confirmParams: { return_url: `${window.location.origin}${route.path}?added=1` }, redirect: 'if_required' })
      if (res.error) {
        error.value = res.error.message ?? t('booking.pay.declined')
        return
      }
    }
    adding.value = false
    toast.add({ title: t('account.payments.added'), color: 'success', icon: 'i-lucide-check' })
    await load()
  }
  finally {
    busy.value = false
  }
}

const removing = ref<SavedCard | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: (v: boolean) => { if (!v) removing.value = null } })
async function remove() {
  if (!removing.value) return
  try {
    await api.cards.remove(removing.value.id)
    removing.value = null
    await load()
  }
  catch (e) {
    toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
    removing.value = null
  }
}
const brand = (b: string) => b.charAt(0).toUpperCase() + b.slice(1)
</script>

<template>
  <MzAccountShell :title="t('account.nav.payments')" :description="t('account.payments.intro')">
    <div v-if="loading" aria-busy="true"><MzSkeleton class="h-20" /></div>
    <UAlert v-else-if="failed" :title="t('booking.pay.providerUnavailable')" color="warning" variant="subtle" />
    <template v-else>
      <p v-if="!cards.length && !adding" class="text-muted">{{ t('account.payments.empty') }}</p>
      <ul v-if="cards.length" class="flex flex-col gap-3">
        <li v-for="card in cards" :key="card.id" class="flex flex-wrap items-center justify-between gap-3 rounded-sm p-4 ring ring-default">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-credit-card" class="size-5 text-muted" aria-hidden="true" />
            <div class="flex flex-col">
              <span class="font-medium text-highlighted">{{ t('account.payments.card', { brand: brand(card.brand), last4: card.last4 }) }}</span>
              <span class="text-small text-muted">{{ t('account.payments.expires', { date: `${String(card.exp_month).padStart(2, '0')}/${card.exp_year}` }) }}</span>
            </div>
            <UBadge v-if="card.in_use" :label="t('account.payments.inUse')" color="info" variant="subtle" />
          </div>
          <UButton :label="t('account.payments.remove')" color="error" variant="ghost" size="sm" :disabled="card.in_use" @click="removing = card" />
        </li>
      </ul>
      <UAlert v-if="error" :title="error" color="error" variant="subtle" role="alert" />
      <section v-if="adding" class="flex max-w-lg flex-col gap-4 rounded-sm p-6 ring ring-default">
        <h2 class="font-display text-h3 text-highlighted">{{ t('account.payments.add') }}</h2>
        <p v-if="fake" class="text-small text-muted">{{ t('account.payments.fake') }}</p>
        <div v-else ref="mount" />
        <div class="flex gap-2">
          <UButton :label="t('account.payments.save')" :loading="busy" @click="confirm" />
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="adding = false" />
        </div>
      </section>
      <UButton v-else :label="t('account.payments.add')" icon="i-lucide-plus" :loading="busy" class="self-start" @click="startAdding" />
      <p class="text-caption text-muted">{{ t('account.payments.safety') }}</p>
    </template>
    <MzConfirmDialog v-model:open="removeOpen" danger :title="t('account.payments.confirmRemove')" :confirm-label="t('account.payments.remove')" @confirm="remove" />
  </MzAccountShell>
</template>
