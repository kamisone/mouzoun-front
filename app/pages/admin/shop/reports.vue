<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/** Sales by day, product and category for a date range (Africa/Casablanca), with CSV export. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.reports' })
const { t } = useI18n()
const admin = useAdminApi()
const { money } = useMoney()
const { date } = useDate()
const today = new Date()
const range = reactive({ from: new Date(today.getTime() - 29 * 86400_000).toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) })
const { data } = await useAsyncData(() => `admin-shop-report-${range.from}-${range.to}`, () => admin.shop.report({ ...range }), { watch: [range] })
const r = computed(() => data.value as Json | null)
const max = computed(() => Math.max(1, ...((r.value?.days ?? []) as Json[]).map(d => d.sales_minor)))
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="t('admin.shop.nav.reports')">
      <template #actions>
        <UInput v-model="range.from" type="date" :aria-label="t('admin.shop.orders.from')" />
        <UInput v-model="range.to" type="date" :aria-label="t('admin.shop.orders.to')" />
        <UButton :to="admin.url(`${admin.shop.reportCsvPath}&from=${range.from}&to=${range.to}`)" external target="_blank" icon="i-lucide-download" label="CSV" color="neutral" variant="outline" />
      </template>
    </MzPageHeader>
    <div v-if="r" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MzStatCard :label="t('admin.shop.reports.sales')" :value="money(r.totals.sales_minor)" />
      <MzStatCard :label="t('admin.shop.reports.orders')" :value="r.totals.orders" />
      <MzStatCard :label="t('admin.shop.reports.aov')" :value="money(r.totals.average_order_minor)" />
      <MzStatCard :label="t('admin.shop.reports.refunds')" :value="money(r.totals.refunded_minor)" />
      <MzStatCard v-if="r.totals.stock_value_minor !== null" :label="t('admin.shop.reports.stockValue')" :value="money(r.totals.stock_value_minor)" />
    </div>
    <UCard v-if="r">
      <template #header><h2 class="font-medium">{{ t('admin.shop.reports.byDay') }}</h2></template>
      <table class="w-full text-small">
        <caption class="sr-only">{{ t('admin.shop.reports.byDay') }}</caption>
        <tbody>
          <tr v-for="d in r.days" :key="d.day">
            <th scope="row" class="w-32 py-1 text-start font-normal text-muted">{{ date(d.day) }}</th>
            <td class="py-1"><div class="h-3 rounded-sm bg-primary" :style="{ width: `${(d.sales_minor / max) * 100}%` }" /></td>
            <td class="w-28 py-1 text-end tabular-nums">{{ money(d.sales_minor) }}</td>
            <td class="w-12 py-1 text-end tabular-nums text-muted">{{ d.orders }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>
    <div v-if="r" class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.reports.topProducts') }}</h2></template>
        <table class="w-full text-small"><tbody>
          <tr v-for="p in r.products" :key="p.product_id" class="border-t border-default"><td class="py-1">{{ p.name }}</td><td class="py-1 text-end tabular-nums">{{ p.units }}</td><td class="py-1 text-end tabular-nums">{{ money(p.sales_minor) }}</td><td v-if="p.margin_minor !== null" class="py-1 text-end tabular-nums text-muted">{{ money(p.margin_minor) }}</td></tr>
        </tbody></table>
      </UCard>
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.reports.byCategory') }}</h2></template>
        <table class="w-full text-small"><tbody>
          <tr v-for="c in r.categories" :key="c.name" class="border-t border-default"><td class="py-1">{{ c.name }}</td><td class="py-1 text-end tabular-nums">{{ c.units }}</td><td class="py-1 text-end tabular-nums">{{ money(c.sales_minor) }}</td></tr>
        </tbody></table>
      </UCard>
    </div>
  </div>
</template>
