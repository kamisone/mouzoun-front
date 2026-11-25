<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * French operation of the shop: the compliance checklist (the shop cannot open while an item
 * fails), the legal entities with an invoice preview, VAT rates to confirm, the OSS threshold,
 * withdrawals to refund, and the accounting exports (sales journal, documents, Stripe).
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.france' })
const { t } = useI18n()
const admin = useAdminApi()
const { money } = useMoney()
const { date } = useDate()
const { can, act } = useShopAdmin()

const [{ data: compliance, refresh: refreshCompliance }, { data: entities, refresh: refreshEntities }, { data: tax, refresh: refreshTax }, { data: withdrawals }] = await Promise.all([
  useAsyncData('admin-shop-compliance', () => admin.shop.france.compliance()),
  useAsyncData('admin-shop-entities', () => admin.shop.france.entities()),
  useAsyncData('admin-shop-tax-rates', () => admin.shop.france.taxRates()),
  useAsyncData('admin-shop-withdrawals', () => admin.shop.france.withdrawals()),
])

// Legal entities: edited one at a time.
const editing = ref<Json | null>(null)
function edit(e: Json) {
  editing.value = JSON.parse(JSON.stringify({ ...e, registration: e.registration ?? {}, address: e.address ?? {}, invoice_footer: { fr: '', en: '', ar: '', ...e.invoice_footer } }))
}
const regFields = computed(() => editing.value?.country_code === 'FR' ? ['siren', 'siret', 'rcs_city', 'vat_number', 'ape_code'] : ['ice', 'if', 'rc', 'patente', 'cnss'])
async function saveEntity() {
  const e = editing.value
  if (!e) return
  const ok = await act(() => admin.shop.france.saveEntity(e.id, {
    legal_name: e.legal_name, legal_form: e.legal_form, share_capital_minor: e.share_capital_minor, address: e.address,
    registration: e.registration, email: e.email, phone: e.phone, publication_director: e.publication_director, host: e.host,
    invoice_footer: e.invoice_footer,
  }), t('admin.shop.products.saved'))
  if (ok) {
    editing.value = null
    await Promise.all([refreshEntities(), refreshCompliance()])
  }
}

async function confirmRate(r: Json) {
  const ok = await act(() => admin.shop.france.saveRate({
    tax_class_code: r.tax_class_code, country_code: r.country_code, rate_percent: r.rate_percent, valid_from: r.valid_from,
    valid_until: r.valid_until, is_active: r.is_active, is_confirmed: true, note: r.note,
  }, r.id), t('admin.shop.products.saved'))
  if (ok) await Promise.all([refreshTax(), refreshCompliance()])
}
const frRates = computed(() => (tax.value?.rates ?? []).filter(r => r.is_active))

// Accounting exports for a period (default: the previous month).
const now = new Date()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const from = ref(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
const to = ref(iso(new Date(now.getFullYear(), now.getMonth(), 0)))
const exports = ['sales-journal', 'documents', 'stripe'] as const
/** Label of a field code of the legal entity form (`registration.siren` → "SIREN"). */
const fieldLabel = (code: string) => t(`admin.legalEntity.fields.${code.replace('.', '_')}`)
const ossColor = (l: string) => (l === 'exceeded' ? 'error' : l === 'warning' ? 'warning' : 'success')
</script>

<template>
  <div class="flex max-w-5xl flex-col gap-6">
    <MzPageHeader :title="t('admin.shop.nav.france')" :description="t('admin.shop.france.intro')" />

    <UCard data-testid="compliance">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-medium">{{ t('admin.shop.france.checklist') }}</h2>
          <UBadge :color="compliance?.ok ? 'success' : 'warning'" variant="soft" :label="compliance?.ok ? t('admin.shop.france.ready') : t('admin.shop.france.notReady')" />
        </div>
      </template>
      <ul class="flex flex-col gap-2">
        <li v-for="i in compliance?.items ?? []" :key="i.code" class="flex items-start gap-3" :data-testid="`check-${i.code}`">
          <UIcon :name="i.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="mt-1 size-5 shrink-0" :class="i.ok ? 'text-success' : 'text-error'" aria-hidden="true" />
          <div class="flex flex-col gap-1">
            <p>{{ t(`admin.shop.france.items.${i.code}`) }}</p>
            <template v-if="!i.ok">
              <p v-if="i.detail?.link" class="flex flex-wrap items-center gap-2 text-small text-muted">
                <span v-if="i.detail.missing?.length">{{ t('admin.shop.france.missingFields', { fields: i.detail.missing.map((f: string) => fieldLabel(f)).join(', ') }) }}</span>
                <UButton :to="i.detail.link" :label="t('admin.shop.france.completeFields')" size="xs" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right" :data-testid="`check-${i.code}-link`" />
              </p>
              <p v-else-if="i.code === 'shipping_rates_france' && i.detail?.placeholders" class="text-small text-warning">{{ t('admin.shop.france.placeholderRates', { n: i.detail.placeholders }) }}</p>
              <p v-else-if="i.code === 'food_information'" class="text-small text-muted">{{ t('admin.shop.france.foodMissing', { n: i.detail?.missing ?? 0 }) }}<template v-if="i.detail?.products?.length"> — {{ i.detail.products.join(', ') }}</template></p>
              <p v-else-if="i.code === 'stripe_webhook' && i.detail?.reason" class="text-small text-muted" dir="ltr">{{ i.detail.reason }}</p>
              <p v-else-if="i.detail && Object.keys(i.detail).length" class="text-small text-muted" dir="ltr">{{ JSON.stringify(i.detail) }}</p>
            </template>
            <p v-else-if="i.code === 'shipping_rates_france' && i.detail?.placeholders" class="text-small text-warning">{{ t('admin.shop.france.placeholderRates', { n: i.detail.placeholders }) }}</p>
          </div>
        </li>
      </ul>
      <p class="mt-3 text-small text-muted">{{ t('admin.shop.france.checklistHint') }}</p>
    </UCard>

    <UCard>
      <template #header><h2 class="font-medium">{{ t('admin.shop.france.entities') }}</h2></template>
      <ul class="flex flex-col divide-y divide-default">
        <li v-for="e in entities?.data ?? []" :key="e.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p class="font-medium">{{ e.legal_name }} <span class="text-muted">· {{ e.code }} · {{ e.country_code }}</span></p>
            <p class="text-small text-muted">{{ [e.address?.line1, e.address?.postal_code, e.address?.city].filter(Boolean).join(', ') }}</p>
          </div>
          <div class="flex gap-2">
            <UButton :to="admin.url(admin.shop.france.invoicePreviewPath(e.id))" external target="_blank" icon="i-lucide-file-text" :label="t('admin.shop.france.preview')" color="neutral" variant="outline" size="sm" />
            <UButton v-if="can('shop.settings')" icon="i-lucide-pencil" :label="t('common.edit')" color="neutral" variant="outline" size="sm" @click="edit(e)" />
          </div>
        </li>
      </ul>
      <form v-if="editing" class="mt-4 grid gap-3 border-t border-default pt-4 sm:grid-cols-2" @submit.prevent="saveEntity">
        <UFormField :label="t('admin.shop.france.legalName')" name="legal_name" required><UInput v-model="editing.legal_name" class="w-full" /></UFormField>
        <UFormField :label="t('admin.shop.france.legalForm')" name="legal_form" required><UInput v-model="editing.legal_form" class="w-full" /></UFormField>
        <UFormField :label="t('admin.shop.france.address')" name="line1"><UInput v-model="editing.address.line1" class="w-full" /></UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('shop.checkout.address.postal_code')" name="postal"><UInput v-model="editing.address.postal_code" dir="ltr" class="w-full" /></UFormField>
          <UFormField :label="t('shop.checkout.address.city')" name="city"><UInput v-model="editing.address.city" class="w-full" /></UFormField>
        </div>
        <UFormField v-for="f in regFields" :key="f" :label="t(`admin.shop.france.registration.${f}`)" :name="f"><UInput v-model="editing.registration[f]" dir="ltr" class="w-full" /></UFormField>
        <UFormField :label="t('shop.checkout.email')" name="email"><UInput v-model="editing.email" type="email" dir="ltr" class="w-full" /></UFormField>
        <UFormField :label="t('admin.shop.france.director')" name="director"><UInput v-model="editing.publication_director" class="w-full" /></UFormField>
        <UFormField v-for="l in ['fr', 'en', 'ar']" :key="l" :label="`${t('admin.shop.france.footer')} (${l})`" :name="`footer-${l}`" class="sm:col-span-2"><UTextarea v-model="editing.invoice_footer[l]" :rows="2" class="w-full" /></UFormField>
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :label="t('common.save')" icon="i-lucide-save" />
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="editing = null" />
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-medium">{{ t('admin.shop.france.vat') }}</h2>
          <UBadge v-if="tax?.oss" :color="ossColor(tax.oss.level)" variant="soft" :label="t('admin.shop.france.oss', { amount: money(tax.oss.eu_distance_sales_minor), threshold: money(tax.oss.threshold_minor) })" />
        </div>
      </template>
      <p v-if="tax?.oss?.level !== 'ok'" class="mb-3 text-small text-warning" role="alert">{{ t('admin.shop.france.ossWarning') }}</p>
      <table class="w-full text-small">
        <thead class="text-muted"><tr><th class="p-2 text-start">{{ t('admin.shop.france.country') }}</th><th class="p-2 text-start">{{ t('admin.shop.products.taxClass') }}</th><th class="p-2 text-end">%</th><th class="p-2 text-start">{{ t('admin.shop.france.since') }}</th><th class="p-2" /></tr></thead>
        <tbody>
          <tr v-for="r in frRates" :key="r.id" class="border-t border-default">
            <td class="p-2">{{ r.country_code }}</td>
            <td class="p-2">{{ t(`admin.shop.taxClasses.${r.tax_class_code}`) }}</td>
            <td class="p-2 text-end tabular-nums">{{ r.rate_percent }}</td>
            <td class="p-2">{{ r.valid_from ? date(r.valid_from) : '—' }}</td>
            <td class="p-2 text-end">
              <UBadge v-if="r.is_confirmed" color="success" variant="soft" :label="t('admin.shop.france.confirmed')" />
              <UButton v-else-if="can('shop.pricing')" size="xs" :label="t('admin.shop.france.confirm')" @click="confirmRate(r)" />
            </td>
          </tr>
        </tbody>
      </table>
      <p class="mt-2 text-small text-muted">{{ t('admin.shop.france.vatHint') }}</p>
    </UCard>

    <UCard>
      <template #header><h2 class="font-medium">{{ t('admin.shop.france.withdrawals') }}</h2></template>
      <MzEmptyState v-if="!withdrawals?.data.length" icon="i-lucide-undo-2" :title="t('admin.shop.france.noWithdrawals')" description="" />
      <ul v-else class="flex flex-col divide-y divide-default">
        <li v-for="w in withdrawals.data" :key="w.id" class="flex items-center justify-between gap-3 py-2 text-small">
          <NuxtLink :to="`/admin/shop/orders/${w.order_id}`" class="underline">{{ w.number }} · {{ w.order_number }}</NuxtLink>
          <UBadge :color="w.days_left <= 3 ? 'error' : w.days_left <= 7 ? 'warning' : 'neutral'" variant="soft" :label="t('admin.shop.france.refundBy', { date: date(w.refund_due_by), days: w.days_left })" />
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header><h2 class="font-medium">{{ t('admin.shop.france.exports') }}</h2></template>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="t('admin.shop.france.from')" name="from"><UInput v-model="from" type="date" /></UFormField>
        <UFormField :label="t('admin.shop.france.to')" name="to"><UInput v-model="to" type="date" /></UFormField>
        <UButton v-for="k in exports" :key="k" :to="admin.url(admin.shop.france.exportPath(k, from, to))" external target="_blank" icon="i-lucide-download" :label="t(`admin.shop.france.export.${k}`)" color="neutral" variant="outline" />
      </div>
    </UCard>
  </div>
</template>
