<script setup lang="ts">
import type { SettingField } from '~/utils/catalog-admin-api'

/** Tarifs › Plans tarifaires: cancellation policy, meals, deposit, payment, public or not. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.ratePlans' })
const { t, locale } = useI18n()
const api = useAdminApi()
const { refs, load, name } = useCatalogRefs()
await load()
const { money } = useMoney()
const fields = computed<SettingField[]>(() => [
  { key: 'code', type: 'code', label: t('admin.catalog.settings.code') },
  { key: 'names', type: 'names', label: t('admin.catalog.settings.name') },
  { key: 'cancellation_policy_id', type: 'select', label: t('admin.catalog.settings.policy'), options: [{ value: undefined, label: '—' }, ...(refs.value?.cancellation_policies ?? []).map(p => ({ value: p.id, label: name(p) }))] },
  { key: 'meal_plan', type: 'select', label: t('admin.catalog.settings.mealPlan'), options: ['none', 'breakfast', 'half_board', 'full_board'].map(v => ({ value: v, label: t(`admin.catalog.settings.meals.${v}`) })) },
  { key: 'deposit_type', type: 'select', label: t('admin.catalog.settings.deposit'), options: ['none', 'percent', 'fixed', 'full'].map(v => ({ value: v, label: t(`admin.catalog.settings.deposits.${v}`) })) },
  { key: 'deposit_percent', type: 'percent', label: t('admin.catalog.settings.depositPercent'), when: f => f.deposit_type === 'percent' },
  { key: 'deposit_amount_minor', type: 'money', label: t('admin.catalog.settings.depositAmount'), when: f => f.deposit_type === 'fixed' },
  { key: 'payment_mode', type: 'select', label: t('admin.catalog.settings.payment'), options: ['pay_on_site', 'optional_online', 'online_required'].map(v => ({ value: v, label: t(`admin.catalog.settings.payments.${v}`) })) },
  { key: 'is_public', type: 'switch', label: t('admin.catalog.settings.public') },
  { key: 'is_active', type: 'switch', label: t('admin.catalog.active') },
  { key: 'sort_order', type: 'number', label: t('admin.catalog.settings.order') },
])
const deposit = (r: Record<string, any>) => (r.deposit_type === 'percent' ? `${r.deposit_percent} %` : r.deposit_type === 'fixed' ? money(r.deposit_amount_minor) : t(`admin.catalog.settings.deposits.${r.deposit_type}`)) // eslint-disable-line @typescript-eslint/no-explicit-any
</script>

<template>
  <MzSettingsScreen
    :title="t('admin.catalog.nav.ratePlans')"
    :description="t('admin.catalog.settings.ratePlansIntro')"
    :api="api.catalog.ratePlans"
    :fields="fields"
    :blank="() => ({ code: '', names: {}, descriptions: {}, cancellation_policy_id: undefined, meal_plan: 'none', deposit_type: 'none', deposit_percent: null, deposit_amount_minor: null, payment_mode: 'pay_on_site', is_public: true, is_active: true, sort_order: 0 })"
    :columns="[
      [t('admin.catalog.settings.name'), r => r.names[locale] || r.names.fr || r.code],
      [t('admin.catalog.settings.policy'), r => name(refs?.cancellation_policies.find(p => p.id === r.cancellation_policy_id))],
      [t('admin.catalog.settings.deposit'), deposit],
      [t('admin.catalog.settings.public'), r => (r.is_public ? '✓' : '—')],
    ]"
    permission="pricing.write"
    :usage="r => t('admin.catalog.settings.usedBy', { n: r.price_rules })"
  />
</template>
