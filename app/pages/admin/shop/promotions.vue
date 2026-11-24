<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/** Shop promotions: codes or automatic offers, percent / fixed / free shipping, conditions. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.promotions' })
const { t } = useI18n()
const admin = useAdminApi()
const { money } = useMoney()
const { can, act } = useShopAdmin()
const { data, refresh } = await useAsyncData('admin-shop-promotions', () => admin.shop.promotions.list())
const blank = (): Json => ({ code: '', scope: 'shop', discount_type: 'percent', percent: 10, amount: 5, min_subtotal: null, min_quantity: null, starts_at: '', ends_at: '', applies_to_all: true, applies_to_shipping: false, is_stackable: false, is_active: false, customer_eligibility: 'all', max_redemptions: null, max_per_customer: null, category_ids: [], product_ids: [], name_fr: '', name_en: '', name_ar: '' })
const form = ref<Json>(blank())
const editing = ref<string | null>(null)
const open = ref(false)
function edit(p?: Json) {
  editing.value = p?.id ?? null
  form.value = p
    ? { ...blank(), ...p, percent: p.percent ? Number(p.percent) : 10, amount: p.amount_minor ? p.amount_minor / 100 : 5, min_subtotal: p.min_subtotal_minor ? p.min_subtotal_minor / 100 : null, starts_at: p.starts_at?.slice(0, 16) ?? '', ends_at: p.ends_at?.slice(0, 16) ?? '', name_fr: p.translations.fr?.name ?? '', name_en: p.translations.en?.name ?? '', name_ar: p.translations.ar?.name ?? '' }
    : blank()
  open.value = true
}
async function save() {
  const f = form.value
  const body = {
    code: f.code || null, scope: f.scope, discount_type: f.discount_type, percent: f.discount_type === 'percent' ? String(f.percent) : null,
    amount_minor: f.discount_type === 'fixed_amount' ? Math.round(f.amount * 100) : null, min_subtotal_minor: f.min_subtotal ? Math.round(f.min_subtotal * 100) : null,
    min_quantity: f.min_quantity || null, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    applies_to_all: f.applies_to_all, applies_to_shipping: f.applies_to_shipping, is_stackable: f.is_stackable, is_active: f.is_active,
    customer_eligibility: f.customer_eligibility, max_redemptions: f.max_redemptions || null, max_per_customer: f.max_per_customer || null,
    category_ids: f.applies_to_all ? [] : f.category_ids, product_ids: f.applies_to_all ? [] : f.product_ids,
    translations: { fr: { name: f.name_fr }, en: { name: f.name_en }, ar: { name: f.name_ar } },
  }
  if (await act(() => admin.shop.promotions.save(body, editing.value ?? undefined), t('admin.shop.products.saved'))) {
    open.value = false
    await refresh()
  }
}
const describe = (p: Json) => p.discount_type === 'percent' ? `−${Number(p.percent)} %` : p.discount_type === 'fixed_amount' ? `−${money(p.amount_minor)}` : t('admin.shop.promotions.types.free_shipping')
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.nav.promotions')">
      <template #actions><UButton v-if="can('shop.pricing')" icon="i-lucide-plus" :label="t('admin.shop.promotions.new')" @click="edit()" /></template>
    </MzPageHeader>
    <table class="w-full text-small">
      <thead class="text-muted"><tr><th class="p-2 text-start">{{ t('admin.shop.promotions.code') }}</th><th class="p-2 text-start">{{ t('admin.shop.promotions.discount') }}</th><th class="p-2 text-start">{{ t('admin.shop.promotions.conditions') }}</th><th class="p-2 text-end">{{ t('admin.shop.promotions.used') }}</th><th class="p-2 text-start">{{ t('admin.shop.orders.status') }}</th></tr></thead>
      <tbody>
        <tr v-for="p in data?.data ?? []" :key="p.id" class="cursor-pointer border-t border-default hover:bg-elevated" @click="can('shop.pricing') && edit(p)">
          <td class="p-2 font-medium" dir="ltr">{{ p.code ?? t('admin.shop.promotions.automatic') }}</td>
          <td class="p-2">{{ describe(p) }}</td>
          <td class="p-2 text-muted">{{ t(`admin.shop.promotions.eligibility.${p.customer_eligibility}`) }}<template v-if="p.min_subtotal_minor"> · ≥ {{ money(p.min_subtotal_minor) }}</template><template v-if="p.ends_at"> · {{ new Date(p.ends_at).toLocaleDateString() }}</template></td>
          <td class="p-2 text-end tabular-nums">{{ p.redemptions }}<template v-if="p.max_redemptions"> / {{ p.max_redemptions }}</template></td>
          <td class="p-2"><UBadge :color="p.is_active ? 'success' : 'neutral'" variant="soft" :label="p.is_active ? t('admin.shop.promotions.active') : t('admin.shop.promotions.inactive')" /></td>
        </tr>
      </tbody>
    </table>
    <UModal v-model:open="open" :title="editing ? t('admin.shop.promotions.edit') : t('admin.shop.promotions.new')">
      <template #body>
        <form id="promo" class="grid gap-3 sm:grid-cols-2" @submit.prevent="save">
          <UFormField :label="t('admin.shop.promotions.code')" :help="t('admin.shop.promotions.codeHint')" name="code"><UInput v-model="form.code" dir="ltr" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.scope')" name="scope"><USelect v-model="form.scope" :items="['shop', 'all'].map(s => ({ value: s, label: t(`admin.shop.promotions.scopes.${s}`) }))" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.discount')" name="type"><USelect v-model="form.discount_type" :items="['percent', 'fixed_amount', 'free_shipping'].map(s => ({ value: s, label: t(`admin.shop.promotions.types.${s}`) }))" class="w-full" /></UFormField>
          <UFormField v-if="form.discount_type === 'percent'" label="%" name="percent"><UInputNumber v-model="form.percent" :min="1" :max="100" class="w-full" /></UFormField>
          <UFormField v-if="form.discount_type === 'fixed_amount'" :label="t('admin.shop.orders.amount')" name="amount"><UInputNumber v-model="form.amount" :min="0.01" :step="0.01" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.minSubtotal')" name="min"><UInputNumber v-model="form.min_subtotal" :min="0" :step="0.01" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.minQuantity')" name="minq"><UInputNumber v-model="form.min_quantity" :min="1" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.starts')" name="starts"><UInput v-model="form.starts_at" type="datetime-local" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.ends')" name="ends"><UInput v-model="form.ends_at" type="datetime-local" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.eligibilityLabel')" name="elig"><USelect v-model="form.customer_eligibility" :items="['all', 'first_order', 'staying_guests'].map(s => ({ value: s, label: t(`admin.shop.promotions.eligibility.${s}`) }))" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.maxRedemptions')" name="maxr"><UInputNumber v-model="form.max_redemptions" :min="1" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.promotions.maxPerCustomer')" name="maxc"><UInputNumber v-model="form.max_per_customer" :min="1" class="w-full" /></UFormField>
          <USwitch v-model="form.applies_to_all" :label="t('admin.shop.promotions.allProducts')" />
          <UFormField v-if="!form.applies_to_all" :label="t('shop.filters.category')" name="cats" class="sm:col-span-2"><MzCategoryPicker v-model="form.category_ids" multiple /></UFormField>
          <USwitch v-if="form.discount_type === 'percent'" v-model="form.applies_to_shipping" :label="t('admin.shop.promotions.onShipping')" />
          <USwitch v-model="form.is_stackable" :label="t('admin.shop.promotions.stackable')" />
          <USwitch v-model="form.is_active" :label="t('admin.shop.promotions.active')" />
          <UInput v-for="l in ['fr', 'en', 'ar']" :key="l" v-model="form[`name_${l}`]" :placeholder="`${t('admin.shop.products.name')} (${l})`" :aria-label="`${t('admin.shop.products.name')} (${l})`" />
        </form>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton type="submit" form="promo" :label="t('common.save')" />
      </template>
    </UModal>
  </div>
</template>
