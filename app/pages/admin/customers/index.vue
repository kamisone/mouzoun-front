<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CrmCustomerRow } from '~/utils/admin-types'

/** Customers: search, with / without an account, and the accounts report at the top. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.customers' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const { money } = useMoney()
const { date } = useDate()
const { percent } = useNumber()

const filters = reactive({
  q: String(route.query.q ?? ''),
  account: String(route.query.account ?? 'all'),
  page: Number(route.query.page ?? 1),
})
const query = computed(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== 'all')))
watchDebounced(() => ({ ...filters }), () => router.replace({ query: Object.fromEntries(Object.entries(query.value).map(([k, v]) => [k, String(v)])) }), { debounce: 300, deep: true })
const { data, pending } = await useAsyncData('admin-crm', () => admin.crm.list(query.value), { watch: [query] })
const { data: report } = await useAsyncData('admin-crm-report', () => admin.crm.report().catch(() => null))

const accountItems = computed(() => [
  { label: t('admin.crm.allCustomers'), value: 'all' },
  { label: t('admin.crm.withAccount'), value: 'with' },
  { label: t('admin.crm.withoutAccount'), value: 'without' },
])
const columns: TableColumn<CrmCustomerRow>[] = [
  { id: 'name', header: t('admin.crm.name') },
  { id: 'account', header: t('admin.crm.account') },
  { accessorKey: 'bookings', header: t('admin.crm.bookings') },
  { id: 'paid', header: t('admin.crm.paid') },
  { id: 'last_stay', header: t('admin.crm.lastStay') },
]
const signups = computed(() => report.value?.signups_per_week.reduce((n, w) => n + w.count, 0) ?? null)
const share = computed(() => (report.value?.bookings.total ? percent(report.value.bookings.with_account / report.value.bookings.total) : null))
const topMethod = computed(() => report.value?.sign_in_methods[0]?.method ?? null)
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.customers')" :description="t('admin.crm.description')" />

    <div class="grid gap-4 md:grid-cols-3">
      <MzStatCard :label="t('admin.crm.signups90')" :value="signups" icon="i-lucide-user-plus" :loading="!report" />
      <MzStatCard :label="t('admin.crm.bookingsWithAccount')" :value="share" icon="i-lucide-percent" :loading="!report" />
      <MzStatCard :label="t('admin.crm.topMethod')" :value="topMethod ? t(`admin.crm.methods.${topMethod}`, topMethod) : null" icon="i-lucide-key-round" :loading="!report" />
    </div>

    <div class="grid gap-2 md:grid-cols-3">
      <UInput v-model="filters.q" icon="i-lucide-search" :placeholder="t('admin.crm.search')" :aria-label="t('admin.crm.search')" class="md:col-span-2" />
      <USelect v-model="filters.account" :items="accountItems" :aria-label="t('admin.crm.account')" />
    </div>

    <UTable :data="data?.customers ?? []" :columns="columns" :loading="pending" class="rounded-sm border border-default" @select="(_e: Event, row: { original: CrmCustomerRow }) => navigateTo(`/admin/customers/${row.original.id}`)">
      <template #name-cell="{ row }">
        <NuxtLink :to="`/admin/customers/${row.original.id}`" class="flex flex-col">
          <span class="font-medium text-highlighted">{{ row.original.first_name }} {{ row.original.last_name }}</span>
          <span class="text-xs text-muted">{{ row.original.email ?? row.original.phone }}</span>
        </NuxtLink>
      </template>
      <template #account-cell="{ row }">
        <UBadge
          v-if="row.original.has_account"
          :label="t(`admin.crm.status.${row.original.account_status}`)"
          :color="row.original.account_status === 'suspended' ? 'error' : 'success'"
          variant="subtle"
        />
        <span v-else class="text-muted">—</span>
      </template>
      <template #paid-cell="{ row }">{{ money(row.original.paid_minor) }}</template>
      <template #last_stay-cell="{ row }">{{ row.original.last_stay ? date(row.original.last_stay) : '—' }}</template>
    </UTable>
    <UPagination v-if="(data?.total ?? 0) > 50" v-model:page="filters.page" :total="data?.total ?? 0" :items-per-page="50" class="self-center" />
  </div>
</template>
