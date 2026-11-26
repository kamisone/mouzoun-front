<script setup lang="ts">
import type { SettingField } from '~/utils/catalog-admin-api'

/** Tarifs › Conditions d'annulation: "plus de X heures avant : Y % remboursé". */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.policies' })
const { t, locale } = useI18n()
const api = useAdminApi()
const fields: SettingField[] = [
  { key: 'code', type: 'code', label: t('admin.catalog.settings.code') },
  { key: 'names', type: 'names', label: t('admin.catalog.settings.name') },
  { key: 'rules', type: 'rules', label: t('admin.catalog.settings.rules'), help: t('admin.catalog.settings.rulesHint') },
  { key: 'is_default', type: 'switch', label: t('admin.catalog.settings.default') },
]
const rules = (r: Record<string, any>) => r.rules.map((x: { min_hours_before: number, refund_percent: number }) => t('admin.catalog.settings.ruleText', { hours: x.min_hours_before, percent: x.refund_percent })).join(' · ') // eslint-disable-line @typescript-eslint/no-explicit-any
</script>

<template>
  <MzSettingsScreen
    :title="t('admin.catalog.nav.policies')"
    :description="t('admin.catalog.settings.policiesIntro')"
    :api="api.catalog.policies"
    :fields="fields"
    :blank="() => ({ code: '', names: {}, descriptions: {}, rules: [{ min_hours_before: 48, refund_percent: 100 }, { min_hours_before: 0, refund_percent: 0 }], is_default: false })"
    :columns="[
      [t('admin.catalog.settings.name'), r => `${r.names[locale] || r.names.fr || r.code}${r.is_default ? ` (${t('admin.catalog.settings.default')})` : ''}`],
      [t('admin.catalog.settings.rules'), rules],
    ]"
    permission="pricing.write"
    :usage="r => t('admin.catalog.settings.usedByPlans', { n: r.rate_plans })"
  />
</template>
