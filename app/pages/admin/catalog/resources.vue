<script setup lang="ts">
import type { SettingField } from '~/utils/catalog-admin-api'

/** Catalogue › Ressources: quads, guides, animals... counted by the activities' requirements. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.resources' })
const { t } = useI18n()
const api = useAdminApi()
const { data: guides } = await useAsyncData('catalog-guides', () => api.catalog.guides())
const KINDS = ['vehicle', 'equipment', 'animal', 'guide', 'room', 'other']
const fields = computed<SettingField[]>(() => [
  { key: 'kind', type: 'select', label: t('admin.catalog.resources.kind'), options: KINDS.map(k => ({ value: k, label: t(`admin.catalog.resources.kinds.${k}`) })) },
  { key: 'code', type: 'code', label: t('admin.catalog.settings.code') },
  { key: 'name', type: 'text', label: t('admin.catalog.settings.name') },
  { key: 'seats', type: 'number', label: t('admin.catalog.resources.seats') },
  { key: 'user_id', type: 'select', label: t('admin.catalog.resources.user'), when: f => f.kind === 'guide', options: [{ value: undefined, label: '—' }, ...(guides.value?.data ?? []).map(g => ({ value: g.id, label: g.name }))] },
  { key: 'status', type: 'select', label: t('admin.catalog.units.status'), options: ['active', 'maintenance', 'retired'].map(s => ({ value: s, label: t(`admin.catalog.units.statuses.${s}`) })) },
  { key: 'notes', type: 'textarea', label: t('admin.catalog.units.notes') },
])
</script>

<template>
  <MzSettingsScreen
    :title="t('admin.catalog.nav.resources')"
    :description="t('admin.catalog.resources.intro')"
    :api="api.catalog.resources"
    :fields="fields"
    :blank="() => ({ kind: 'vehicle', code: '', name: '', seats: null, user_id: undefined, status: 'active', notes: '' })"
    :columns="[
      [t('admin.catalog.settings.code'), r => r.code],
      [t('admin.catalog.settings.name'), r => r.name],
      [t('admin.catalog.resources.kind'), r => t(`admin.catalog.resources.kinds.${r.kind}`)],
      [t('admin.catalog.units.status'), r => t(`admin.catalog.units.statuses.${r.status}`)],
      [t('admin.catalog.resources.user'), r => r.user_name ?? '—'],
    ]"
    permission="inventory.write"
    :section="t('admin.catalog.title')"
  />
</template>
