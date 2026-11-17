<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AdminOrderRow } from '~/utils/shop-admin-api'

/**
 * Orders: filters kept in the URL (status, payment, fulfilment, channel, dates, tag, risk,
 * search), server-side sort and pages, saved views (in this browser).
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.orders' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const { money } = useMoney()
const { date } = useDate()
const { statusColor } = useShopAdmin()

const filters = computed(() => ({
  status: route.query.status as string | undefined,
  payment_status: route.query.payment_status as string | undefined,
  fulfillment_status: route.query.fulfillment_status as string | undefined,
  channel: route.query.channel as string | undefined,
  from: route.query.from as string | undefined,
  to: route.query.to as string | undefined,
  tag: route.query.tag as string | undefined,
  risk_level: route.query.risk_level as string | undefined,
  q: route.query.q as string | undefined,
  view: route.query.view as string | undefined,
  sort: route.query.sort as string | undefined,
  page: Number(route.query.page ?? 1),
  per_page: 25,
}))
const { data, pending } = await useAsyncData(() => `admin-shop-orders-${JSON.stringify(filters.value)}`, () => admin.shop.orders.list(filters.value), { watch: [filters] })

function set(patch: Record<string, string | number | undefined>) {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...route.query, page: undefined, ...patch })) if (v !== undefined && v !== '' && v !== null) q[k] = String(v)
  router.replace({ query: q })
}
const search = ref(filters.value.q ?? '')
watchDebounced(search, q => set({ q }), { debounce: 300 })

const views = [
  { key: '', label: t('admin.shop.orders.views.all') },
  { key: 'to_confirm', label: t('admin.shop.dash.toConfirm') },
  { key: 'to_fulfil', label: t('admin.shop.dash.toFulfil') },
  { key: 'ready_for_pickup', label: t('admin.shop.dash.readyForPickup') },
  { key: 'drafts', label: t('admin.shop.orders.views.drafts') },
]
const opts = (prefix: string, values: string[]) => [{ value: 'all', label: t('admin.shop.orders.any') }, ...values.map(v => ({ value: v, label: t(`${prefix}.${v}`) }))]

// Saved views: the current filters under a name, in this browser.
const saved = useLocalStorage<{ name: string, query: Record<string, string> }[]>('mz-shop-order-views', [])
function saveView() {
  const name = window.prompt(t('admin.shop.orders.viewName'))
  if (name) saved.value = [...saved.value, { name, query: { ...route.query } as Record<string, string> }]
}

const columns: TableColumn<AdminOrderRow>[] = [
  { accessorKey: 'number', header: t('admin.shop.orders.number') },
  { accessorKey: 'placed_at', header: t('admin.shop.orders.date') },
  { accessorKey: 'customer', header: t('admin.shop.orders.customer') },
  { accessorKey: 'status', header: t('admin.shop.orders.status') },
  { accessorKey: 'payment_status', header: t('admin.shop.orders.payment') },
  { accessorKey: 'fulfillment_status', header: t('admin.shop.orders.fulfillment') },
  { accessorKey: 'total_minor', header: t('admin.shop.orders.total') },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.nav.orders')">
      <template #actions>
        <UButton to="/admin/shop/orders/new" icon="i-lucide-plus" :label="t('admin.shop.orders.newDraft')" />
      </template>
    </MzPageHeader>
    <div class="flex flex-wrap gap-1" role="tablist">
      <UButton v-for="v in views" :key="v.key" :label="v.label" size="sm" :color="(filters.view ?? '') === v.key ? 'primary' : 'neutral'" :variant="(filters.view ?? '') === v.key ? 'solid' : 'ghost'" @click="set({ view: v.key || undefined })" />
      <UButton v-for="v in saved" :key="v.name" :label="v.name" size="sm" color="neutral" variant="outline" @click="router.replace({ query: v.query })" />
      <UButton :label="t('admin.shop.orders.saveView')" icon="i-lucide-bookmark-plus" size="sm" color="neutral" variant="link" @click="saveView" />
    </div>
    <div class="flex flex-wrap gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('admin.shop.orders.search')" :aria-label="t('admin.shop.orders.search')" class="w-64" />
      <USelect :model-value="filters.status || 'all'" :items="opts('shop.order.statuses', ['draft', 'pending', 'open', 'completed', 'cancelled'])" :aria-label="t('admin.shop.orders.status')" class="w-40" @update:model-value="v => set({ status: v === 'all' ? undefined : v })" />
      <USelect :model-value="filters.payment_status || 'all'" :items="opts('shop.order.payment', ['unpaid', 'pending', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided'])" :aria-label="t('admin.shop.orders.payment')" class="w-44" @update:model-value="v => set({ payment_status: v === 'all' ? undefined : v })" />
      <USelect :model-value="filters.fulfillment_status || 'all'" :items="opts('shop.order.fulfillment', ['unfulfilled', 'partially_fulfilled', 'fulfilled', 'partially_returned', 'returned'])" :aria-label="t('admin.shop.orders.fulfillment')" class="w-44" @update:model-value="v => set({ fulfillment_status: v === 'all' ? undefined : v })" />
      <USelect :model-value="filters.channel || 'all'" :items="opts('admin.shop.channels', ['website', 'admin', 'camp_pos', 'phone', 'whatsapp'])" :aria-label="t('admin.shop.orders.channel')" class="w-36" @update:model-value="v => set({ channel: v === 'all' ? undefined : v })" />
      <USelect :model-value="filters.risk_level || 'all'" :items="opts('admin.shop.risk', ['normal', 'review', 'high'])" :aria-label="t('admin.shop.orders.risk')" class="w-36" @update:model-value="v => set({ risk_level: v === 'all' ? undefined : v })" />
      <UInput type="date" :model-value="filters.from" :aria-label="t('admin.shop.orders.from')" @update:model-value="v => set({ from: String(v) || undefined })" />
      <UInput type="date" :model-value="filters.to" :aria-label="t('admin.shop.orders.to')" @update:model-value="v => set({ to: String(v) || undefined })" />
      <UInput :model-value="filters.tag" :placeholder="t('admin.shop.orders.tag')" :aria-label="t('admin.shop.orders.tag')" class="w-28" @change="(e: Event) => set({ tag: (e.target as HTMLInputElement).value || undefined })" />
      <USelect :model-value="filters.sort || 'all'" :items="[{ value: 'all', label: t('admin.shop.orders.sort.newest') }, { value: 'placed_asc', label: t('admin.shop.orders.sort.oldest') }, { value: 'total_desc', label: t('admin.shop.orders.sort.totalDesc') }, { value: 'total_asc', label: t('admin.shop.orders.sort.totalAsc') }]" :aria-label="t('shop.filters.sort')" class="w-40" @update:model-value="v => set({ sort: v === 'all' ? undefined : v })" />
    </div>
    <UTable :data="data?.data ?? []" :columns="columns" :loading="pending" class="rounded-md border border-default" data-testid="admin-orders">
      <template #number-cell="{ row }">
        <NuxtLink :to="`/admin/shop/orders/${row.original.id}`" class="font-medium text-highlighted underline-offset-2 hover:underline">{{ row.original.number }}</NuxtLink>
        <UBadge v-if="row.original.to_confirm" color="warning" variant="soft" size="sm" class="ms-2" :label="t('admin.shop.dash.toConfirm')" />
        <UBadge v-if="row.original.risk_level !== 'normal'" color="error" variant="soft" size="sm" class="ms-2" :label="t(`admin.shop.risk.${row.original.risk_level}`)" />
      </template>
      <template #placed_at-cell="{ row }">{{ date(row.original.placed_at ?? row.original.created_at) }}</template>
      <template #customer-cell="{ row }">
        <div>{{ row.original.customer }}</div>
        <div class="text-small text-muted">{{ row.original.email }}</div>
      </template>
      <template #status-cell="{ row }"><UBadge :color="statusColor(row.original.status)" variant="soft" :label="t(`shop.order.statuses.${row.original.status}`)" /></template>
      <template #payment_status-cell="{ row }"><UBadge :color="statusColor(row.original.payment_status)" variant="soft" :label="t(`shop.order.payment.${row.original.payment_status}`)" /></template>
      <template #fulfillment_status-cell="{ row }">{{ t(`shop.order.fulfillment.${row.original.fulfillment_status}`) }}</template>
      <template #total_minor-cell="{ row }"><span class="tabular-nums">{{ money(row.original.total_minor, row.original.currency) }}</span></template>
    </UTable>
    <UPagination v-if="(data?.total ?? 0) > 25" :page="filters.page" :total="data?.total ?? 0" :items-per-page="25" @update:page="p => set({ page: p })" />
  </div>
</template>
