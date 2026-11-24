<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AdminProductRow } from '~/utils/shop-admin-api'

/** Shop products: thumbnails, status, stock, price range; bulk publish / archive / category; CSV. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.products' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const { money } = useMoney()
const { can, act, statusColor } = useShopAdmin()
const query = computed(() => ({ q: route.query.q as string | undefined, status: route.query.status as string | undefined, category_id: route.query.category as string | undefined, sort: route.query.sort as string | undefined, page: Number(route.query.page ?? 1), per_page: 25 }))
const { data, pending, refresh } = await useAsyncData(() => `admin-shop-products-${JSON.stringify(query.value)}`, () => admin.shop.products.list(query.value), { watch: [query] })
const search = ref(query.value.q ?? '')
watchDebounced(search, q => router.replace({ query: { ...route.query, q: q || undefined, page: undefined } }), { debounce: 300 })
const selected = ref<string[]>([])
const bulkCategory = ref<string>()
async function bulk(action: string) {
  await act(() => admin.shop.products.bulk({ ids: selected.value, action, category_id: bulkCategory.value }), t('admin.shop.products.bulkDone'))
  selected.value = []
  await refresh()
}
const importOpen = ref(false)
const csv = ref('')
const report = ref<Record<string, unknown> | null>(null)
async function runImport(dry: boolean) {
  report.value = (await act(() => admin.shop.products.importCsv(csv.value, dry))) ?? null
  if (!dry) await refresh()
}
const columns: TableColumn<AdminProductRow>[] = [
  { id: 'select', header: '' },
  { accessorKey: 'name', header: t('admin.shop.products.name') },
  { accessorKey: 'status', header: t('admin.shop.orders.status') },
  { accessorKey: 'price_min_minor', header: t('shop.filters.price') },
  { accessorKey: 'stock_total', header: t('admin.shop.products.stock') },
  { accessorKey: 'locales', header: t('admin.shop.products.languages') },
]
const toggle = (id: string, on: boolean) => { selected.value = on ? [...selected.value, id] : selected.value.filter(x => x !== id) }
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.nav.products')">
      <template #actions>
        <UButton :to="admin.url(admin.shop.products.exportPath)" external target="_blank" icon="i-lucide-download" :label="t('admin.shop.products.export')" color="neutral" variant="outline" />
        <UButton v-if="can('shop.catalog')" icon="i-lucide-upload" :label="t('admin.shop.products.import')" color="neutral" variant="outline" @click="importOpen = true" />
        <UButton v-if="can('shop.catalog')" to="/admin/shop/products/new" icon="i-lucide-plus" :label="t('admin.shop.products.new')" />
      </template>
    </MzPageHeader>
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('admin.shop.products.search')" :aria-label="t('admin.shop.products.search')" class="w-64" />
      <USelect :model-value="query.status || 'all'" :items="[{ value: 'all', label: t('admin.shop.orders.any') }, ...['draft', 'published', 'archived'].map(s => ({ value: s, label: t(`admin.shop.products.statuses.${s}`) }))]" class="w-40" :aria-label="t('admin.shop.orders.status')" @update:model-value="v => router.replace({ query: { ...route.query, status: v === 'all' ? undefined : v } })" />
      <div class="w-56">
        <MzCategoryPicker
          :model-value="(route.query.category as string) || null"
          :none-label="t('admin.shop.orders.any')"
          :placeholder="t('shop.filters.category')"
          @update:model-value="v => router.replace({ query: { ...route.query, category: typeof v === 'string' ? v : undefined, page: undefined } })"
        />
      </div>
      <template v-if="selected.length && can('shop.catalog')">
        <span class="text-small text-muted">{{ t('admin.shop.products.selected', { n: selected.length }) }}</span>
        <UButton :label="t('admin.shop.products.publish')" size="sm" @click="bulk('publish')" />
        <UButton :label="t('admin.shop.products.archive')" size="sm" color="neutral" variant="outline" @click="bulk('archive')" />
        <div class="w-56"><MzCategoryPicker v-model="bulkCategory" :placeholder="t('shop.filters.category')" /></div>
        <UButton :label="t('admin.shop.products.setCategory')" size="sm" color="neutral" variant="outline" :disabled="!bulkCategory" @click="bulk('set_category')" />
      </template>
    </div>
    <UTable :data="data?.data ?? []" :columns="columns" :loading="pending" class="rounded-md border border-default">
      <template #select-cell="{ row }"><UCheckbox :model-value="selected.includes(row.original.id)" :aria-label="row.original.name" @update:model-value="v => toggle(row.original.id, !!v)" /></template>
      <template #name-cell="{ row }">
        <NuxtLink :to="`/admin/shop/products/${row.original.id}`" class="flex items-center gap-3">
          <img v-if="row.original.image_url" :src="row.original.image_url" alt="" class="size-10 rounded object-cover">
          <span class="font-medium text-highlighted hover:underline">{{ row.original.name || '—' }}</span>
        </NuxtLink>
      </template>
      <template #status-cell="{ row }"><UBadge :color="statusColor(row.original.status)" variant="soft" :label="t(`admin.shop.products.statuses.${row.original.status}`)" /></template>
      <template #price_min_minor-cell="{ row }">
        <span class="tabular-nums">{{ row.original.price_min_minor !== null ? money(row.original.price_min_minor) : '—' }}<template v-if="row.original.price_max_minor !== row.original.price_min_minor && row.original.price_max_minor !== null"> – {{ money(row.original.price_max_minor) }}</template></span>
      </template>
      <template #stock_total-cell="{ row }"><span class="tabular-nums">{{ row.original.stock_total }}</span> <span class="text-small text-muted">· {{ t('admin.shop.products.variants', { n: row.original.variant_count }) }}</span></template>
      <template #locales-cell="{ row }"><span class="text-small uppercase">{{ (row.original.locales ?? []).join(' · ') }}</span></template>
    </UTable>
    <UPagination v-if="(data?.total ?? 0) > 25" :page="query.page" :total="data?.total ?? 0" :items-per-page="25" @update:page="p => router.replace({ query: { ...route.query, page: p } })" />
    <UModal v-model:open="importOpen" :title="t('admin.shop.products.import')" :description="t('admin.shop.products.importHint')">
      <template #body>
        <UTextarea v-model="csv" :rows="8" class="w-full font-mono" placeholder="sku,price_minor,compare_at_price_minor,weight_grams,status" />
        <div v-if="report" class="mt-3 text-small">
          <p>{{ t('admin.shop.products.importReport', { ok: report.ok, errors: report.errors }) }}</p>
          <ul class="max-h-40 overflow-auto"><li v-for="(r, i) in (report.rows as Record<string, unknown>[])" :key="i" :class="r.error ? 'text-error' : ''">{{ r.line }} · {{ r.sku }} · {{ r.error ?? JSON.stringify(r.changes) }}</li></ul>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('admin.shop.products.dryRun')" color="neutral" variant="outline" @click="runImport(true)" />
        <UButton :label="t('admin.shop.products.apply')" :disabled="!report || (report.errors as number) > 0" @click="runImport(false)" />
      </template>
    </UModal>
  </div>
</template>
