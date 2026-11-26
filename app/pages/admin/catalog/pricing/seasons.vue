<script setup lang="ts">
import type { SettingField } from '~/utils/catalog-admin-api'

/** Tarifs › Saisons: code, name, colour, priority (higher wins on overlaps), periods. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.seasons' })
const { t, locale } = useI18n()
const api = useAdminApi()
const { date } = useDate()
const fields: SettingField[] = [
  { key: 'code', type: 'code', label: t('admin.catalog.settings.code') },
  { key: 'names', type: 'names', label: t('admin.catalog.settings.name') },
  { key: 'color', type: 'color', label: t('admin.catalog.settings.color') },
  { key: 'priority', type: 'number', label: t('admin.catalog.settings.priority'), help: t('admin.catalog.settings.priorityHint') },
  { key: 'periods', type: 'periods', label: t('admin.catalog.settings.periods'), help: t('admin.catalog.settings.periodsHint') },
]
// A season's colour is data (stored on the season, shown on the calendar), not a design token.
const DEFAULT_COLOR = '#7FB3D5' // lint-tokens-ignore
const year = new Date().getUTCFullYear()
const months = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(locale.value, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, m, 15))))
const { data } = await useAsyncData('catalog-seasons-year', () => api.catalog.seasons.list())
/** Share of each month of the current year covered by the season. */
function cover(periods: { from: string, to: string }[], m: number): number {
  const start = Date.UTC(year, m, 1)
  const end = Date.UTC(year, m + 1, 1)
  let days = 0
  for (const p of periods) {
    const a = Math.max(start, Date.parse(`${p.from}T00:00:00Z`))
    const b = Math.min(end, Date.parse(`${p.to}T00:00:00Z`))
    if (b > a) days += (b - a) / 86_400_000
  }
  return Math.min(1, days / ((end - start) / 86_400_000))
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzSettingsScreen
      :title="t('admin.catalog.nav.seasons')"
      :description="t('admin.catalog.settings.seasonsIntro')"
      :api="api.catalog.seasons"
      :fields="fields"
      :blank="() => ({ code: '', names: {}, color: DEFAULT_COLOR, priority: 0, periods: [] })"
      :columns="[
        [t('admin.catalog.settings.name'), r => r.names[locale] || r.names.fr || r.code],
        [t('admin.catalog.settings.priority'), r => String(r.priority)],
        [t('admin.catalog.settings.periods'), r => r.periods.map((p: { from: string, to: string }) => `${date(p.from)} → ${date(p.to)}`).join(' · ')],
      ]"
      permission="pricing.write"
      :usage="r => t('admin.catalog.settings.usedBy', { n: r.price_rules })"
    />
    <section class="flex flex-col gap-2" :aria-label="t('admin.catalog.settings.yearView', { year })">
      <h2 class="font-medium">{{ t('admin.catalog.settings.yearView', { year }) }}</h2>
      <div class="grid grid-cols-[8rem_repeat(12,minmax(0,1fr))] gap-1 text-caption">
        <span />
        <span v-for="m in months" :key="m" class="text-center text-muted">{{ m }}</span>
        <template v-for="s in data?.data ?? []" :key="s.id">
          <span class="truncate">{{ s.names[locale] || s.names.fr || s.code }}</span>
          <span v-for="(_, m) in months" :key="m" class="h-4 rounded-xs bg-muted">
            <span class="block h-4 rounded-xs" :style="{ width: `${cover(s.periods, m) * 100}%`, backgroundColor: s.color ?? undefined }" />
          </span>
        </template>
      </div>
    </section>
  </div>
</template>
