<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * Inventory: variant × location grid (on hand, reserved, available), receive / adjust / count /
 * transfer, lots with best-before, the movement ledger, CSV export, low-stock filter.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.inventory' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const { date, dateTime } = useDate()
const { can, act } = useShopAdmin()
const tab = computed({ get: () => (route.query.tab as string) || 'grid', set: v => router.replace({ query: { ...route.query, tab: v } }) })
const query = computed(() => ({ q: route.query.q as string | undefined, low_only: route.query.low_only === '1', variant: route.query.variant as string | undefined, page: Number(route.query.page ?? 1), per_page: 50 }))
const { data: grid, refresh } = await useAsyncData(() => `admin-shop-grid-${JSON.stringify(query.value)}`, () => admin.shop.inventory.grid(query.value), { watch: [query] })
const { data: locations } = await useAsyncData('admin-shop-locations', () => admin.shop.locations.list())
const { data: lots, refresh: refreshLots } = await useLazyAsyncData('admin-shop-lots', () => admin.shop.inventory.lots({ expiring_within_days: route.query.tab === 'lots' ? 3650 : undefined }), { server: false })
const movementFilter = reactive({ reason: 'all', page: 1 })
const { data: movements, refresh: refreshMovements } = await useLazyAsyncData(() => `admin-shop-movements-${movementFilter.reason}-${movementFilter.page}`, () => admin.shop.inventory.movements({ reason: movementFilter.reason === 'all' ? undefined : movementFilter.reason, page: movementFilter.page, per_page: 50 }), { server: false, watch: [movementFilter] })
const search = ref(query.value.q ?? '')
watchDebounced(search, q => router.replace({ query: { ...route.query, q: q || undefined } }), { debounce: 300 })

// One operation dialog for every kind.
const open = ref(false)
const op = reactive<Json>({ operation: 'receive', variant_id: '', location_id: '', quantity: 1, delta: -1, counted: 0, reason: 'damage', note: '', to_location_id: '', lot_code: '', best_before: '', unit_cost: null, lot_id: null, track_lots: false, label: '' })
function start(operation: string, row: Json, level?: Json) {
  Object.assign(op, { operation, variant_id: row.variant_id, location_id: level?.location_id ?? locations.value?.data[0]?.id, quantity: 1, delta: -1, counted: level?.on_hand ?? 0, note: '', lot_code: '', best_before: '', lot_id: null, track_lots: row.track_lots, label: `${row.name} ${row.options} (${row.sku})` })
  open.value = true
}
async function submit() {
  const base = { variant_id: op.variant_id, note: op.note || undefined }
  const body: Json = op.operation === 'receive'
    ? { ...base, operation: 'receive', location_id: op.location_id, quantity: op.quantity, unit_cost_minor: op.unit_cost ? Math.round(op.unit_cost * 100) : undefined, lot: op.lot_code ? { lot_code: op.lot_code, best_before: op.best_before || null } : undefined }
    : op.operation === 'adjust'
      ? { ...base, operation: 'adjust', location_id: op.location_id, delta: op.delta, reason: op.reason, lot_id: op.lot_id || undefined }
      : op.operation === 'count'
        ? { ...base, operation: 'count', location_id: op.location_id, counted: op.counted, lot_id: op.lot_id || undefined }
        : { ...base, operation: 'transfer', from_location_id: op.location_id, to_location_id: op.to_location_id, quantity: op.quantity }
  const out = await act(() => admin.shop.inventory.operate(body), t('admin.shop.inventory.done'))
  if (out) {
    open.value = false
    await Promise.all([refresh(), refreshLots(), refreshMovements()])
  }
}
const variantLots = computed(() => (lots.value?.data ?? []).filter((l: Json) => l.variant_id === op.variant_id && l.location_id === op.location_id))
const locationItems = computed(() => (locations.value?.data ?? []).map((l: Json) => ({ value: l.id, label: l.code })))
const soon = (d: string | null) => !!d && new Date(d).getTime() < Date.now() + 30 * 86400_000
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.nav.inventory')">
      <template #actions>
        <UButton :to="admin.url(admin.shop.inventory.exportPath)" external target="_blank" icon="i-lucide-download" :label="t('admin.shop.products.export')" color="neutral" variant="outline" />
      </template>
    </MzPageHeader>
    <UTabs v-model="tab" :items="[{ label: t('admin.shop.inventory.grid'), value: 'grid' }, { label: t('admin.shop.inventory.lots'), value: 'lots' }, { label: t('admin.shop.inventory.movements'), value: 'movements' }]" variant="link" :content="false" />

    <template v-if="tab === 'grid'">
      <div class="flex flex-wrap items-center gap-3">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('admin.shop.products.search')" :aria-label="t('admin.shop.products.search')" class="w-64" />
        <USwitch :model-value="query.low_only" :label="t('admin.shop.dash.lowStock')" @update:model-value="v => router.replace({ query: { ...route.query, low_only: v ? '1' : undefined } })" />
      </div>
      <div class="overflow-x-auto rounded-md border border-default">
        <table class="w-full text-small" data-testid="inventory-grid">
          <thead class="bg-elevated text-muted"><tr><th class="p-2 text-start">{{ t('admin.shop.products.name') }}</th><th v-for="l in locations?.data ?? []" :key="l.id" class="p-2 text-start">{{ l.code }}</th><th class="p-2 text-end">{{ t('admin.shop.inventory.available') }}</th><th /></tr></thead>
          <tbody>
            <tr v-for="row in grid?.data ?? []" :key="row.variant_id" class="border-t border-default">
              <td class="p-2"><p class="font-medium text-highlighted">{{ row.name }} <span class="text-muted">{{ row.options }}</span></p><p class="text-muted" dir="ltr">{{ row.sku }}<template v-if="!row.track_inventory"> · {{ t('admin.shop.inventory.untracked') }}</template></p></td>
              <td v-for="l in locations?.data ?? []" :key="l.id" class="p-2 tabular-nums">
                <template v-for="lv in row.levels.filter((x: Json) => x.location_id === l.id)" :key="lv.location_id">
                  <span :title="t('admin.shop.inventory.onHand')">{{ lv.on_hand }}</span>
                  <span v-if="lv.reserved" class="text-muted"> / {{ t('admin.shop.inventory.reservedShort', { n: lv.reserved }) }}</span>
                  <UButton v-if="can('shop.stock')" icon="i-lucide-clipboard-check" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.shop.inventory.count')" @click="start('count', row, lv)" />
                </template>
              </td>
              <td class="p-2 text-end tabular-nums" :class="row.available <= row.threshold && row.track_inventory ? 'text-warning font-medium' : ''">{{ row.available }}</td>
              <td class="p-2 text-end">
                <UDropdownMenu v-if="can('shop.stock')" :items="['receive', 'adjust', 'count', 'transfer'].map(o => ({ label: t(`admin.shop.inventory.${o}`), onSelect: () => start(o, row) }))">
                  <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.shop.inventory.actions')" />
                </UDropdownMenu>
                <UButton :label="t('admin.shop.inventory.movements')" size="xs" color="neutral" variant="link" @click="router.replace({ query: { tab: 'movements', variant: row.variant_id } })" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="tab === 'lots'">
      <table class="w-full text-small">
        <thead class="text-muted"><tr><th class="p-2 text-start">{{ t('admin.shop.inventory.lot') }}</th><th class="p-2 text-start">{{ t('admin.shop.products.name') }}</th><th class="p-2 text-start">{{ t('admin.shop.inventory.location') }}</th><th class="p-2 text-start">{{ t('admin.shop.inventory.bestBefore') }}</th><th class="p-2 text-end">{{ t('admin.shop.products.stock') }}</th></tr></thead>
        <tbody>
          <tr v-for="l in lots?.data ?? []" :key="l.id" class="border-t border-default">
            <td class="p-2 font-medium" dir="ltr">{{ l.lot_code }}</td>
            <td class="p-2">{{ l.name }} <span class="text-muted" dir="ltr">{{ l.sku }}</span></td>
            <td class="p-2">{{ l.location }}</td>
            <td class="p-2" :class="soon(l.best_before) && 'text-warning font-medium'">{{ l.best_before ? date(l.best_before) : '—' }}</td>
            <td class="p-2 text-end tabular-nums">{{ l.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else>
      <USelect v-model="movementFilter.reason" :items="[{ value: 'all', label: t('admin.shop.orders.any') }, ...['receipt', 'sale', 'return_restock', 'adjustment', 'count', 'damage', 'expired', 'transfer_in', 'transfer_out', 'correction'].map(r => ({ value: r, label: t(`admin.shop.reasons.${r}`) }))]" class="w-48" :aria-label="t('admin.shop.inventory.reason')" />
      <table class="w-full text-small" data-testid="movements">
        <thead class="text-muted"><tr><th class="p-2 text-start">{{ t('admin.shop.orders.date') }}</th><th class="p-2 text-start">SKU</th><th class="p-2 text-start">{{ t('admin.shop.inventory.location') }}</th><th class="p-2 text-start">{{ t('admin.shop.inventory.reason') }}</th><th class="p-2 text-end">Δ</th><th class="p-2 text-end">{{ t('admin.shop.inventory.after') }}</th><th class="p-2 text-start">{{ t('admin.shop.inventory.ref') }}</th></tr></thead>
        <tbody>
          <tr v-for="m in (movements?.data ?? []).filter((x: Json) => !route.query.variant || x.variant_id === route.query.variant)" :key="m.id" class="border-t border-default">
            <td class="p-2">{{ dateTime(m.created_at) }}</td>
            <td class="p-2" dir="ltr">{{ m.sku }}<template v-if="m.lot_code"> · {{ m.lot_code }}</template></td>
            <td class="p-2">{{ m.location }}</td>
            <td class="p-2">{{ t(`admin.shop.reasons.${m.reason}`) }}</td>
            <td class="p-2 text-end tabular-nums" :class="m.delta < 0 ? 'text-error' : 'text-success'">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</td>
            <td class="p-2 text-end tabular-nums">{{ m.on_hand_after }}</td>
            <td class="p-2"><NuxtLink v-if="m.order_id" :to="`/admin/shop/orders/${m.order_id}`" class="underline">{{ m.order_number }}</NuxtLink> {{ m.note }} <span class="text-muted">{{ m.user }}</span></td>
          </tr>
        </tbody>
      </table>
      <UPagination v-if="(movements?.total ?? 0) > 50" v-model:page="movementFilter.page" :total="movements?.total ?? 0" :items-per-page="50" />
    </template>

    <UModal v-model:open="open" :title="t(`admin.shop.inventory.${op.operation}`)" :description="op.label">
      <template #body>
        <form id="stock-op" class="flex flex-col gap-3" @submit.prevent="submit">
          <UFormField :label="op.operation === 'transfer' ? t('admin.shop.inventory.from') : t('admin.shop.inventory.location')" name="location"><USelect v-model="op.location_id" :items="locationItems" class="w-full" /></UFormField>
          <UFormField v-if="op.operation === 'transfer'" :label="t('admin.shop.inventory.to')" name="to"><USelect v-model="op.to_location_id" :items="locationItems" class="w-full" /></UFormField>
          <UFormField v-if="op.operation === 'receive' || op.operation === 'transfer'" :label="t('admin.shop.inventory.quantity')" name="qty"><UInputNumber v-model="op.quantity" :min="1" class="w-full" /></UFormField>
          <template v-if="op.operation === 'receive'">
            <UFormField :label="t('admin.shop.inventory.lot')" :required="op.track_lots" name="lot"><UInput v-model="op.lot_code" dir="ltr" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.inventory.bestBefore')" name="bb"><UInput v-model="op.best_before" type="date" class="w-full" /></UFormField>
            <UFormField v-if="can('shop.pricing')" :label="t('admin.shop.products.cost')" name="cost"><UInputNumber v-model="op.unit_cost" :min="0" :step="0.01" class="w-full" /></UFormField>
          </template>
          <template v-if="op.operation === 'adjust'">
            <UFormField :label="t('admin.shop.inventory.delta')" name="delta"><UInputNumber v-model="op.delta" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.inventory.reason')" name="reason"><USelect v-model="op.reason" :items="['damage', 'expired', 'adjustment', 'correction'].map(r => ({ value: r, label: t(`admin.shop.reasons.${r}`) }))" class="w-full" /></UFormField>
          </template>
          <UFormField v-if="op.operation === 'count'" :label="t('admin.shop.inventory.counted')" name="counted"><UInputNumber v-model="op.counted" :min="0" class="w-full" /></UFormField>
          <UFormField v-if="(op.operation === 'adjust' || op.operation === 'count') && op.track_lots" :label="t('admin.shop.inventory.lot')" name="lot-id"><USelect v-model="op.lot_id" :items="variantLots.map((l: Json) => ({ value: l.id, label: `${l.lot_code} · ${l.quantity}` }))" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.inventory.note')" :required="op.operation === 'adjust'" name="note"><UInput v-model="op.note" class="w-full" /></UFormField>
        </form>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton type="submit" form="stock-op" :label="t('common.confirm')" />
      </template>
    </UModal>
  </div>
</template>
