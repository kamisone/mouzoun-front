<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * Shop settings and payment methods. Stripe keys live only in the server environment: this
 * page shows whether they are set (test / live) and when the last webhook arrived.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.settings' })
const { t } = useI18n()
const admin = useAdminApi()
const { dateTime } = useDate()
const { can, act } = useShopAdmin()
const { data, refresh } = await useAsyncData('admin-shop-settings', () => admin.shop.settings.get())
const v = ref<Json>({})
watchEffect(() => { if (data.value) v.value = JSON.parse(JSON.stringify(data.value.values)) })
const stripe = computed(() => data.value?.stripe as Json | undefined)
const toCents = (k: string) => computed({ get: () => (v.value[k] ?? 0) / 100, set: (x: number) => { v.value[k] = Math.round(x * 100) } })
const minOrder = toCents('shop.min_order_minor')
const stayFee = toCents('shop.stay_delivery_fee_minor')
const codMax = computed({ get: () => (v.value['payments.cod.max_order_minor'] ?? null) === null ? null : v.value['payments.cod.max_order_minor'] / 100, set: (x: number | null) => { v.value['payments.cod.max_order_minor'] = x ? Math.round(x * 100) : null } })
const list = (k: string) => computed({ get: () => (v.value[k] ?? []).join(', '), set: (s: string) => { v.value[k] = s.split(',').map(x => x.trim()).filter(Boolean) } })
const countries = list('shop.ships_to_countries')
const carriers = list('shop.carriers')
const notify = list('shop.notify_emails')
async function save() {
  const changed = Object.fromEntries(Object.entries(v.value).filter(([k, x]) => JSON.stringify(x) !== JSON.stringify(data.value?.values[k])))
  if (!Object.keys(changed).length) return
  if (await act(() => admin.shop.settings.update(changed), t('admin.shop.products.saved'))) await refresh()
}
const legalPages = ['cgv', 'notice', 'privacy', 'cookies', 'withdrawal', 'shipping']
// Object settings edited field by field: make sure they exist once the values are loaded.
watch(v, (x) => {
  x['shop.consumer_mediator'] ??= { name: '', url: '' }
  x['shop.checkout_button_label'] ??= {}
}, { immediate: true })
const mediator = computed(() => (v.value['shop.consumer_mediator'] ?? {}) as Json)
const buttonLabel = computed(() => (v.value['shop.checkout_button_label'] ?? {}) as Json)
</script>

<template>
  <div v-if="data" class="flex max-w-4xl flex-col gap-6">
    <MzPageHeader :title="t('admin.shop.nav.settings')">
      <template #actions><UButton v-if="can('shop.settings')" :label="t('common.save')" icon="i-lucide-save" data-testid="save-settings" @click="save" /></template>
    </MzPageHeader>
    <fieldset :disabled="!can('shop.settings')" class="flex flex-col gap-6">
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.settings.general') }}</h2></template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('admin.shop.settings.status')" name="status" class="sm:col-span-2">
            <URadioGroup v-model="v['shop.status']" :items="['closed', 'catalog_only', 'open'].map(s => ({ value: s, label: t(`admin.shop.status.${s}`) }))" orientation="horizontal" />
          </UFormField>
          <UFormField :label="t('admin.shop.settings.minOrder')" name="min"><UInputNumber v-model="minOrder" :min="0" :step="0.01" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.maxPerLine')" name="maxline"><UInputNumber v-model="v['shop.max_quantity_per_line']" :min="1" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.holdMinutes')" name="hold"><UInputNumber v-model="v['shop.checkout_hold_minutes']" :min="30" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.lowStock')" name="low"><UInputNumber v-model="v['shop.low_stock_threshold']" :min="0" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.withdrawal')" name="withdrawal"><UInputNumber v-model="v['shop.withdrawal_days']" :min="0" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.cartTtl')" name="ttl"><UInputNumber v-model="v['shop.cart_ttl_days']" :min="1" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.countries')" name="countries"><UInput v-model="countries" dir="ltr" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.carriers')" name="carriers"><UInput v-model="carriers" dir="ltr" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.notify')" name="notify" class="sm:col-span-2"><UInput v-model="notify" dir="ltr" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.stayFee')" name="stayfee"><UInputNumber v-model="stayFee" :min="0" :step="0.01" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.abandonedHours')" name="abandoned"><UInputNumber v-model="v['shop.abandoned_cart_hours']" :min="1" class="w-full" /></UFormField>
          <USwitch v-model="v['shop.stay_delivery_enabled']" :label="t('admin.shop.settings.stayDelivery')" />
          <USwitch v-model="v['shop.prices_include_tax']" :label="t('admin.shop.settings.pricesIncludeTax')" />
          <USwitch v-model="v['shop.abandoned_cart_requires_consent']" :label="t('admin.shop.settings.abandonedConsent')" />
          <div class="flex gap-2 sm:col-span-2">
            <UFormField v-for="l in ['fr', 'en', 'ar']" :key="l" :label="`${t('admin.shop.settings.prefix')} (${l})`" :help="l === 'fr' ? t('admin.shop.settings.prefixHint') : undefined" :name="`prefix-${l}`"><UInput v-model="v['shop.route_prefix'][l]" dir="ltr" /></UFormField>
          </div>
        </div>
      </UCard>
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.settings.payments') }}</h2></template>
        <div class="flex flex-col gap-4">
          <div class="rounded-md border border-default p-3" data-testid="stripe-status">
            <p class="font-medium">Stripe</p>
            <p class="text-small" :class="stripe?.configured ? 'text-success' : 'text-warning'">
              {{ stripe?.configured ? t('admin.shop.settings.stripeConfigured', { mode: stripe?.mode }) : t('admin.shop.settings.stripeMissing') }}
            </p>
            <p v-if="stripe?.configured" class="text-small text-muted">
              {{ stripe?.last_webhook_at ? t('admin.shop.settings.lastWebhook', { at: dateTime(stripe.last_webhook_at) }) : t('admin.shop.settings.noWebhook') }}
              <template v-if="stripe?.last_webhook_at && !stripe?.webhook_recent"> · {{ t('admin.shop.settings.webhookOld') }}</template>
            </p>
            <p class="mt-1 text-small text-muted">{{ t('admin.shop.settings.webhookHelp', { path: stripe?.webhook_path, events: (stripe?.events ?? []).join(', ') }) }}</p>
            <USwitch v-model="v['payments.stripe.enabled']" class="mt-2" :disabled="!stripe?.configured" :label="t('admin.shop.settings.stripeEnabled')" />
            <USelect v-model="v['payments.stripe.checkout_mode']" class="mt-2 w-48" :items="['hosted', 'embedded'].map(m => ({ value: m, label: t(`admin.shop.settings.mode.${m}`) }))" />
          </div>
          <USwitch v-model="v['payments.cod.enabled']" :label="t('shop.checkout.payment.cash_on_delivery')" />
          <UFormField v-if="v['payments.cod.enabled']" :label="t('admin.shop.settings.codMax')" name="codmax"><UInputNumber v-model="codMax" :min="0" :step="0.01" /></UFormField>
          <USwitch v-model="v['payments.pay_at_pickup.enabled']" :label="t('shop.checkout.payment.pay_at_pickup')" />
          <USwitch v-model="v['payments.bank_transfer.enabled']" :label="t('shop.checkout.payment.bank_transfer')" />
          <template v-if="v['payments.bank_transfer.enabled']">
            <UFormField :label="t('admin.shop.settings.holdDays')" name="holddays"><UInputNumber v-model="v['payments.bank_transfer.hold_days']" :min="1" /></UFormField>
            <UFormField v-for="l in ['fr', 'en', 'ar']" :key="l" :label="`${t('shop.order.bankTransfer')} (${l})`" :name="`bank-${l}`"><UTextarea v-model="v['payments.bank_transfer.details'][l]" :rows="3" class="w-full" /></UFormField>
          </template>
        </div>
      </UCard>
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.settings.legal') }}</h2></template>
        <p class="mb-3 text-small text-muted">{{ t('admin.shop.settings.legalHint') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField v-for="l in ['fr', 'en', 'ar']" :key="l" :label="`${t('admin.shop.settings.buttonLabel')} (${l})`" :help="l === 'fr' ? t('admin.shop.settings.buttonLabelHint') : undefined" :name="`button-${l}`" class="sm:col-span-2">
            <UInput v-model="buttonLabel[l]" class="w-full" :dir="l === 'ar' ? 'rtl' : 'ltr'" />
          </UFormField>
          <UFormField :label="t('admin.shop.settings.refundDays')" name="refund"><UInputNumber v-model="v['shop.refund_deadline_days']" :min="1" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.guaranteeYears')" name="guarantee"><UInputNumber v-model="v['shop.legal_guarantee_years']" :min="1" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.mediatorName')" name="mediator"><UInput v-model="mediator.name" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.settings.mediatorUrl')" name="mediator-url"><UInput v-model="mediator.url" type="url" dir="ltr" class="w-full" /></UFormField>
          <UFormField v-for="k in legalPages" :key="k" :label="t(`footer.legalPages.${k}`)" :help="t('admin.shop.settings.pageIdHint')" :name="`page-${k}`">
            <UInput v-model="v[`legal.${k}_page_id`]" dir="ltr" class="w-full" placeholder="uuid" />
          </UFormField>
        </div>
      </UCard>
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.settings.tax') }}</h2></template>
        <div class="flex flex-col gap-3">
          <USwitch v-model="v['tax.oss_enabled']" :label="t('admin.shop.settings.oss')" :description="t('admin.shop.settings.ossHint')" />
          <USwitch v-model="v['tax.keep_gross_price_constant']" :label="t('admin.shop.settings.grossConstant')" :description="t('admin.shop.settings.grossConstantHint')" />
          <USwitch v-model="v['customs.ioss_enabled']" :label="t('admin.shop.settings.ioss')" />
          <UFormField v-if="v['customs.ioss_enabled']" :label="t('admin.shop.settings.iossNumber')" name="ioss"><UInput v-model="v['customs.ioss_number']" dir="ltr" /></UFormField>
          <USwitch v-model="v['payments.allow_cash_fr']" color="warning" :label="t('admin.shop.settings.allowCash')" :description="t('admin.shop.settings.allowCashHint')" />
        </div>
      </UCard>
    </fieldset>
  </div>
</template>
