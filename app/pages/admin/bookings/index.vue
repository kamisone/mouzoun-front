<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AdminBookingRow } from '~/utils/admin-types'

/**
 * Bookings: search (reference, name, email, phone), filters (status, arrival dates, source,
 * payment, balance due), saved views (this browser), CSV export of the filtered list.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.bookings.title' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const { money } = useMoney()
const { date, dateRange } = useDate()

const filters = reactive({
  q: String(route.query.q ?? ''),
  status: String(route.query.status ?? 'all'),
  arrival_from: String(route.query.arrival_from ?? ''),
  arrival_to: String(route.query.arrival_to ?? ''),
  source: String(route.query.source ?? 'all'),
  payment: String(route.query.payment ?? 'all'),
  balance_due: route.query.balance_due === 'true',
  sort: String(route.query.sort ?? '-created'),
  page: Number(route.query.page ?? 1),
})
// Select menus cannot hold an empty value: 'all' means no filter.
const query = computed(() => Object.fromEntries(Object.entries({ ...filters, balance_due: filters.balance_due || undefined, per_page: 25 }).filter(([, v]) => v !== '' && v !== 'all' && v !== undefined)))
watchDebounced(() => ({ ...filters }), () => router.replace({ query: Object.fromEntries(Object.entries(query.value).map(([k, v]) => [k, String(v)])) }), { debounce: 300, deep: true })
const { data, pending } = await useAsyncData('admin-bookings', () => admin.bookings.list(query.value), { watch: [query] })

const statuses = ['pending', 'awaiting_payment', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'expired']
const sources = ['website', 'phone', 'email', 'whatsapp', 'walk_in', 'agency', 'admin', 'ota']
const statusItems = computed(() => [{ label: t('admin.bookings.allStatuses'), value: 'all' }, ...statuses.map(s => ({ label: t(`status.${s}`), value: s }))])
const sourceItems = computed(() => [{ label: t('admin.bookings.allSources'), value: 'all' }, ...sources.map(s => ({ label: t(`admin.sources.${s}`), value: s }))])
const paymentItems = computed(() => [{ label: t('admin.bookings.anyPayment'), value: 'all' }, ...['unpaid', 'partial', 'paid'].map(s => ({ label: t(`admin.bookings.payment.${s}`), value: s }))])
const sortItems = computed(() => [
  { label: t('admin.bookings.sort.created'), value: '-created' },
  { label: t('admin.bookings.sort.arrival'), value: 'arrival' },
  { label: t('admin.bookings.sort.arrivalDesc'), value: '-arrival' },
])

// Saved views: named filter sets, stored in this browser.
const VIEWS = 'mz-admin-booking-views'
const views = ref<{ name: string, filters: typeof filters }[]>([])
onMounted(() => {
  try {
    views.value = JSON.parse(localStorage.getItem(VIEWS) ?? '[]')
  }
  catch { views.value = [] }
})
function saveView() {
  const name = window.prompt(t('admin.bookings.viewName'))
  if (!name) return
  views.value = [...views.value.filter(v => v.name !== name), { name, filters: { ...filters, page: 1 } }]
  localStorage.setItem(VIEWS, JSON.stringify(views.value))
}
function applyView(v: { filters: typeof filters }) {
  Object.assign(filters, v.filters)
}
const presets = computed(() => [
  { label: t('admin.bookings.presets.requests'), filters: { status: 'pending' } },
  { label: t('admin.bookings.presets.upcoming'), filters: { status: 'confirmed', sort: 'arrival' } },
  { label: t('admin.bookings.presets.balance'), filters: { balance_due: true, sort: 'arrival' } },
])

const columns: TableColumn<AdminBookingRow>[] = [
  { accessorKey: 'reference', header: () => t('admin.bookings.reference') },
  { id: 'guest', header: () => t('admin.bookings.guest') },
  { id: 'dates', header: () => t('admin.bookings.dates') },
  { accessorKey: 'products', header: () => t('admin.bookings.products') },
  { accessorKey: 'status', header: () => t('admin.bookings.status') },
  { id: 'money', header: () => t('admin.bookings.amounts') },
  { accessorKey: 'source', header: () => t('admin.bookings.source') },
]
const exportUrl = computed(() => admin.bookings.exportUrl({ ...query.value, page: undefined, per_page: undefined }))
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.bookings.title')">
      <template #actions>
        <UButton :to="exportUrl" external icon="i-lucide-download" :label="t('admin.bookings.export')" color="neutral" variant="outline" />
        <UButton to="/admin/bookings/new" icon="i-lucide-plus" :label="t('admin.bookings.new')" />
      </template>
    </MzPageHeader>

    <div class="flex flex-wrap items-center gap-2">
      <UButton v-for="p in presets" :key="p.label" :label="p.label" size="sm" color="neutral" variant="soft" @click="Object.assign(filters, { status: 'all', balance_due: false, sort: '-created', page: 1 }, p.filters)" />
      <UButton v-for="v in views" :key="v.name" :label="v.name" size="sm" color="neutral" variant="outline" icon="i-lucide-bookmark" @click="applyView(v)" />
      <UButton :label="t('admin.bookings.saveView')" size="sm" color="neutral" variant="ghost" icon="i-lucide-bookmark-plus" @click="saveView" />
    </div>

    <div class="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
      <UInput v-model="filters.q" icon="i-lucide-search" :placeholder="t('admin.bookings.search')" class="xl:col-span-2" :aria-label="t('admin.bookings.search')" />
      <USelect v-model="filters.status" :items="statusItems" :aria-label="t('admin.bookings.status')" />
      <UInput v-model="filters.arrival_from" type="date" :aria-label="t('admin.bookings.arrivalFrom')" />
      <UInput v-model="filters.arrival_to" type="date" :aria-label="t('admin.bookings.arrivalTo')" />
      <USelect v-model="filters.source" :items="sourceItems" :aria-label="t('admin.bookings.source')" />
      <USelect v-model="filters.payment" :items="paymentItems" :aria-label="t('admin.bookings.paymentState')" />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UCheckbox v-model="filters.balance_due" :label="t('admin.bookings.balanceDue')" />
      <USelect v-model="filters.sort" :items="sortItems" class="w-56" :aria-label="t('admin.bookings.sortLabel')" />
    </div>

    <UTable :data="data?.data ?? []" :columns="columns" :loading="pending" class="rounded-sm border border-default" @select="(_e: Event, row: { original: AdminBookingRow }) => navigateTo(`/admin/bookings/${row.original.id}`)">
      <template #reference-cell="{ row }">
        <NuxtLink :to="`/admin/bookings/${row.original.id}`" class="font-medium text-highlighted lining-nums">{{ row.original.reference }}</NuxtLink>
      </template>
      <template #guest-cell="{ row }">
        <p class="font-medium text-highlighted">{{ row.original.customer.first_name }} {{ row.original.customer.last_name }}</p>
        <p class="text-caption text-muted">{{ row.original.customer.email ?? row.original.customer.phone }}</p>
      </template>
      <template #dates-cell="{ row }">
        <span v-if="row.original.arrival">{{ row.original.departure ? dateRange(row.original.arrival, row.original.departure) : date(row.original.arrival, 'medium') }}</span>
      </template>
      <template #status-cell="{ row }">
        <MzStatusBadge :status="row.original.status" size="sm" />
      </template>
      <template #money-cell="{ row }">
        <p class="tabular-nums">{{ money(row.original.total_minor) }}</p>
        <p v-if="row.original.balance_minor" class="text-caption text-warning">{{ t('admin.bookings.due', { amount: money(row.original.balance_minor) }) }}</p>
      </template>
      <template #source-cell="{ row }">{{ t(`admin.sources.${row.original.source}`) }}</template>
    </UTable>
    <div class="flex items-center justify-between">
      <p class="text-small text-muted">{{ t('admin.bookings.count', { n: data?.total ?? 0 }, data?.total ?? 0) }}</p>
      <UPagination v-model:page="filters.page" :items-per-page="25" :total="data?.total ?? 0" />
    </div>
  </div>
</template>
