<script setup lang="ts">
import type { CatalogKind, CatalogRow } from '~/utils/catalog-admin-api'
import { duration } from '~/utils/catalog'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * List of one kind (stays, activities, packages, extras): thumbnail, name (admin language,
 * French otherwise), status, booking mode, "à partir de" price (pricing engine, next 30 days),
 * key numbers, missing languages, last update. Search, filters and sort live in the URL.
 * Drag a row (or use the arrows) to set the order of the public listings; bulk publish,
 * unpublish and archive.
 */
const props = defineProps<{ kind: CatalogKind }>()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const api = useAdminApi()
const toast = useToast()
const { money } = useMoney()
const { date, dateTime } = useDate()
const { user } = useAuth()
const canWrite = computed(() => user.value?.permissions.includes('products.write') ?? false)
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : undefined)
const filters = computed(() => ({ q: q('q'), status: q('status'), category_id: q('category'), place_id: q('place'), booking_mode: q('mode'), sort: q('sort'), locale: locale.value }))
const { data, pending, refresh } = await useAsyncData(() => `catalog-list-${props.kind}-${JSON.stringify(filters.value)}`, () => api.catalog.list(props.kind, filters.value), { watch: [filters] })
const rows = ref<CatalogRow[]>([])
watchEffect(() => { rows.value = [...(data.value?.data ?? [])] })
const search = ref(filters.value.q ?? '')
watchDebounced(search, v => setQuery({ q: v || undefined }), { debounce: 300 })
function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}
const manual = computed(() => !filters.value.sort || filters.value.sort === 'manual')
const filtered = computed(() => !!(filters.value.q || filters.value.status || filters.value.category_id || filters.value.place_id || filters.value.booking_mode))

// Order: drag and drop (or arrows), saved at once.
const dragging = ref<number | null>(null)
async function persistOrder() {
  try {
    await api.catalog.reorder(props.kind, rows.value.map(r => r.id))
    toast.add({ title: t('admin.catalog.list.orderSaved'), color: 'success' })
  }
  catch {
    toast.add({ title: t('shop.errors.generic'), color: 'error' })
    await refresh()
  }
}
function drop(to: number) {
  const from = dragging.value
  dragging.value = null
  if (from == null || from === to) return
  const next = [...rows.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  rows.value = next
  persistOrder()
}
function move(i: number, by: number) {
  const j = i + by
  if (j < 0 || j >= rows.value.length) return
  dragging.value = i
  drop(j)
}

const selected = ref<string[]>([])
const toggle = (id: string, on: boolean) => { selected.value = on ? [...selected.value, id] : selected.value.filter(x => x !== id) }
async function bulk(action: 'publish' | 'unpublish' | 'archive') {
  try {
    const out = await api.catalog.bulk(props.kind, action, selected.value)
    const failed = out.results.filter(r => !r.ok)
    toast.add({
      title: t('admin.catalog.list.bulkDone', { ok: out.results.length - failed.length, failed: failed.length }),
      description: failed.length ? failed.map(f => `${rows.value.find(r => r.id === f.id)?.name ?? f.id}: ${t(`admin.catalog.errors.${f.code}`)}`).join(' · ') : undefined,
      color: failed.length ? 'warning' : 'success',
    })
  }
  catch (e) {
    toast.add({ title: apiError(e).message ?? t('shop.errors.generic'), color: 'error' })
  }
  selected.value = []
  await refresh()
}
const statusColor = (s: string) => (s === 'published' ? 'success' : s === 'archived' ? 'neutral' : 'warning')
function numbers(r: CatalogRow): string {
  const n = r.numbers
  switch (props.kind) {
    case 'stays':
      return [n.inventory_mode === 'pool' ? t('admin.catalog.list.pool', { n: n.pool_capacity ?? n.units }) : t('admin.catalog.list.units', { n: n.units }), t('admin.catalog.list.guests', { n: n.max_guests })].join(' · ')
    case 'activities':
      return [duration(n.duration_minutes), n.next_departure ? t('admin.catalog.list.next', { date: dateTime(n.next_departure) }) : t(`admin.catalog.activity.modes.${n.scheduling_mode}`),
        n.seats_left_week != null ? t('admin.catalog.list.seatsWeek', { n: n.seats_left_week }) : ''].filter(Boolean).join(' · ')
    case 'packages':
      return [t('admin.catalog.list.nights', { n: n.nights ?? 0 }), t('admin.catalog.list.items', { n: n.items })].join(' · ')
    default:
      return [t(`admin.catalog.extra.targets.${n.applies_to}`), n.stock_quantity != null ? t('admin.catalog.list.stock', { n: n.stock_quantity }) : t('admin.catalog.list.unlimited')].join(' · ')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t(`admin.catalog.nav.${props.kind}`)" :description="t(`admin.catalog.list.intro.${props.kind}`)" :breadcrumbs="[{ label: t('admin.catalog.title') }, { label: t(`admin.catalog.nav.${props.kind}`) }]">
      <template #actions>
        <UButton v-if="canWrite" :to="`/admin/catalog/${props.kind}/new`" icon="i-lucide-plus" :label="t(`admin.catalog.new.${props.kind}`)" data-testid="new-product" />
      </template>
    </MzPageHeader>
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('admin.catalog.list.search')" :aria-label="t('admin.catalog.list.search')" class="w-64" />
      <USelect :model-value="filters.status ?? 'all'" :items="[{ value: 'all', label: t('admin.catalog.list.anyStatus') }, ...['draft', 'published', 'archived'].map(s => ({ value: s, label: t(`admin.catalog.statuses.${s}`) }))]" class="w-40" :aria-label="t('admin.catalog.status')" @update:model-value="v => setQuery({ status: v === 'all' ? undefined : String(v) })" />
      <USelect v-if="props.kind !== 'extras'" :model-value="filters.booking_mode ?? 'all'" :items="[{ value: 'all', label: t('admin.catalog.list.anyMode') }, ...['instant', 'on_request', 'not_bookable'].map(s => ({ value: s, label: t(`admin.catalog.bookingModes.${s}`) }))]" class="w-48" :aria-label="t('admin.catalog.bookingMode')" @update:model-value="v => setQuery({ mode: v === 'all' ? undefined : String(v) })" />
      <div class="w-56"><MzEntityPicker :model-value="filters.category_id" kind="category" scope="product" :label="t('admin.catalog.categories')" :any-label="t('admin.catalog.list.anyCategory')" @update:model-value="v => setQuery({ category: (v as string) || undefined })" /></div>
      <div class="w-56"><MzEntityPicker :model-value="filters.place_id" kind="place" :label="t('admin.catalog.place')" :any-label="t('admin.catalog.list.anyPlace')" @update:model-value="v => setQuery({ place: (v as string) || undefined })" /></div>
      <USelect :model-value="filters.sort ?? 'manual'" :items="['manual', 'name', 'updated'].map(s => ({ value: s, label: t(`admin.catalog.list.sorts.${s}`) }))" class="w-44" :aria-label="t('admin.catalog.list.sort')" @update:model-value="v => setQuery({ sort: v === 'manual' ? undefined : String(v) })" />
    </div>
    <div v-if="selected.length && canWrite" class="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-small" data-testid="bulk-bar">
      <span>{{ t('admin.catalog.list.selected', { n: selected.length }) }}</span>
      <UButton :label="t('admin.catalog.publish')" size="xs" @click="bulk('publish')" />
      <UButton :label="t('admin.catalog.unpublish')" size="xs" color="neutral" variant="outline" @click="bulk('unpublish')" />
      <UButton :label="t('admin.catalog.archive')" size="xs" color="neutral" variant="outline" @click="bulk('archive')" />
    </div>
    <p v-if="manual && canWrite && !filtered && rows.length > 1" class="text-caption text-muted">{{ t('admin.catalog.list.dragHint') }}</p>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[56rem] text-small" :aria-busy="pending">
        <thead>
          <tr class="text-muted">
            <th class="w-8 p-2"><span class="sr-only">{{ t('admin.catalog.list.select') }}</span></th>
            <th class="p-2 text-start">{{ t('admin.catalog.fields.name') }}</th>
            <th class="p-2 text-start">{{ t('admin.catalog.status') }}</th>
            <th v-if="props.kind !== 'extras'" class="p-2 text-start">{{ t('admin.catalog.bookingMode') }}</th>
            <th class="p-2 text-end">{{ t('admin.catalog.list.from') }}</th>
            <th class="p-2 text-start">{{ t('admin.catalog.list.numbers') }}</th>
            <th class="p-2 text-start">{{ t('admin.catalog.list.updated') }}</th>
            <th v-if="manual && canWrite && !filtered" class="p-2"><span class="sr-only">{{ t('admin.catalog.list.order') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in rows"
            :key="r.id"
            class="border-t border-default"
            :class="dragging === i ? 'opacity-50' : ''"
            :draggable="manual && canWrite && !filtered"
            :data-testid="`row-${r.id}`"
            @dragstart="dragging = i"
            @dragover.prevent
            @drop.prevent="drop(i)"
          >
            <td class="p-2"><UCheckbox :model-value="selected.includes(r.id)" :aria-label="t('admin.catalog.list.selectRow', { name: r.name })" @update:model-value="v => toggle(r.id, !!v)" /></td>
            <td class="p-2">
              <div class="flex items-center gap-3">
                <img v-if="r.cover_url" :src="r.cover_url" alt="" class="size-10 rounded-xs object-cover">
                <span v-else class="flex size-10 items-center justify-center rounded-xs bg-muted"><UIcon name="i-lucide-image" class="text-muted" /></span>
                <div class="min-w-0">
                  <ULink :to="`/admin/catalog/${props.kind}/${r.id}`" class="font-medium hover:underline">{{ r.name || '—' }}</ULink>
                  <div class="flex flex-wrap gap-1">
                    <UBadge v-for="l in r.missing_locales" :key="l" :label="t('admin.catalog.list.missingLocale', { locale: l.toUpperCase() })" color="warning" variant="soft" size="sm" />
                    <UBadge v-if="r.is_featured" :label="t('admin.catalog.featured')" color="primary" variant="soft" size="sm" />
                  </div>
                </div>
              </div>
            </td>
            <td class="p-2"><UBadge :label="t(`admin.catalog.statuses.${r.status}`)" :color="statusColor(r.status)" variant="soft" /></td>
            <td v-if="props.kind !== 'extras'" class="p-2">{{ t(`admin.catalog.bookingModes.${r.booking_mode}`) }}</td>
            <td class="p-2 text-end tabular-nums">{{ r.from_price_minor != null ? money(r.from_price_minor) : '—' }}</td>
            <td class="p-2 text-muted">{{ numbers(r) }}</td>
            <td class="p-2 text-muted">{{ date(r.updated_at) }}</td>
            <td v-if="manual && canWrite && !filtered" class="p-2">
              <div class="flex gap-1">
                <UIcon name="i-lucide-grip-vertical" class="cursor-grab text-muted" aria-hidden="true" />
                <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, -1)" />
                <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === rows.length - 1" :aria-label="t('admin.catalog.moveDown')" @click="move(i, 1)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <MzEmptyState v-if="!pending && !rows.length" icon="i-lucide-tent" :title="t('admin.catalog.list.empty')" />
    </div>
  </div>
</template>
