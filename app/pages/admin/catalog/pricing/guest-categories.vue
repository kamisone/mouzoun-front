<script setup lang="ts">
import type { SettingField } from '~/utils/catalog-admin-api'

/** Tarifs › Catégories de voyageurs: age bands priced apart (child at half price...). */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.guestCategories' })
const { t, locale } = useI18n()
const api = useAdminApi()
const fields: SettingField[] = [
  { key: 'code', type: 'code', label: t('admin.catalog.settings.code') },
  { key: 'names', type: 'names', label: t('admin.catalog.settings.name') },
  { key: 'min_age', type: 'number', label: t('admin.catalog.settings.minAge') },
  { key: 'max_age', type: 'number', label: t('admin.catalog.settings.maxAge') },
  { key: 'counts_toward_capacity', type: 'switch', label: t('admin.catalog.settings.countsCapacity') },
  { key: 'is_active', type: 'switch', label: t('admin.catalog.active') },
  { key: 'sort_order', type: 'number', label: t('admin.catalog.settings.order') },
]
const ages = (r: Record<string, any>) => (r.min_age == null && r.max_age == null ? '—' : `${r.min_age ?? 0} – ${r.max_age ?? '∞'}`) // eslint-disable-line @typescript-eslint/no-explicit-any
</script>

<template>
  <MzSettingsScreen
    :title="t('admin.catalog.nav.guestCategories')"
    :description="t('admin.catalog.settings.guestCategoriesIntro')"
    :api="api.catalog.guestCategories"
    :fields="fields"
    :blank="() => ({ code: '', names: {}, min_age: null, max_age: null, counts_toward_capacity: true, is_active: true, sort_order: 0 })"
    :columns="[
      [t('admin.catalog.settings.name'), r => r.names[locale] || r.names.fr || r.code],
      [t('admin.catalog.settings.ages'), ages],
      [t('admin.catalog.settings.countsCapacity'), r => (r.counts_toward_capacity ? '✓' : '—')],
    ]"
    permission="pricing.write"
    :usage="r => t('admin.catalog.settings.usedBy', { n: r.price_rules })"
  />
</template>
