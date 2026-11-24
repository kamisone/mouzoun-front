<script setup lang="ts">
import type { AdminRedirect } from '~/utils/seo-admin-api'

/**
 * Redirections: search, filters and sort kept in the URL, server-side pages; active toggle, edit
 * (drawer), delete, bulk activate / deactivate / delete. Automatic rows link to their content.
 */
const props = defineProps<{ readOnly: boolean }>()
const prefill = defineModel<{ from_path: string, to_path?: string } | null>('prefill', { default: null })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const toast = useToast()
const { date } = useDate()

const query = computed(() => ({
  q: (route.query.q as string) || undefined,
  source: (route.query.source as string) || undefined,
  code: route.query.code ? Number(route.query.code) : undefined,
  active: route.query.active === 'true' ? true : route.query.active === 'false' ? false : undefined,
  stale: route.query.stale === '1' || undefined,
  sort: (route.query.sort as string) || 'created_at',
  dir: (route.query.dir as string) || 'desc',
  page: Number(route.query.page ?? 1) || 1,
  per_page: 25,
}))
const { data, refresh, pending } = await useAsyncData(() => `seo-redirects-${JSON.stringify(query.value)}`, () => admin.seo.redirects(query.value), { watch: [query] })
function update(patch: Record<string, string | undefined>) {
  router.replace({ query: Object.fromEntries(Object.entries({ ...route.query, ...patch, page: patch.page }).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string> })
}
const search = ref(query.value.q ?? '')
watchDebounced(search, q => update({ q: q || undefined }), { debounce: 300 })
function sortBy(column: string) {
  update({ sort: column, dir: query.value.sort === column && query.value.dir === 'desc' ? 'asc' : 'desc', page: undefined })
}
const codes = computed(() => (data.value?.uses_307_308 ? [301, 302, 307, 308] : [301, 302]))

const selected = ref<string[]>([])
const toggle = (id: string, on: boolean) => { selected.value = on ? [...selected.value, id] : selected.value.filter(x => x !== id) }
async function run<T>(fn: () => Promise<T>, done?: string) {
  try {
    const out = await fn()
    if (done) toast.add({ title: done, color: 'success' })
    await refresh()
    return out
  }
  catch (e) {
    const code = (e as { data?: { error?: { details?: { fields?: Record<string, string> } } } }).data?.error?.details?.fields
    toast.add({ title: code ? Object.values(code).map(c => t(`admin.seo.errors.${c}`)).join(' ') : t('shop.errors.generic'), color: 'error' })
  }
}
async function bulk(action: 'activate' | 'deactivate' | 'delete') {
  if (action === 'delete' && !window.confirm(t('admin.seo.redirects.confirmBulkDelete', { n: selected.value.length }))) return
  await run(() => admin.seo.bulk(selected.value, action), t('admin.seo.redirects.bulkDone'))
  selected.value = []
}
async function remove(r: AdminRedirect) {
  if (!window.confirm(t('admin.seo.redirects.confirmDelete', { from: r.from_path }))) return
  await run(() => admin.seo.deleteRedirect(r.id), t('admin.seo.redirects.deleted'))
}

const drawer = ref(false)
const editing = ref<AdminRedirect | null>(null)
function open(row: AdminRedirect | null) {
  editing.value = row
  drawer.value = true
}
watch(prefill, (p) => {
  if (p && !props.readOnly) {
    editing.value = null
    drawer.value = true
  }
}, { immediate: true })
async function saved() {
  drawer.value = false
  prefill.value = null
  await refresh()
}
const contentLink = (r: AdminRedirect) => {
  if (!r.entity_id) return null
  if (r.entity_type === 'shop_product') return `/admin/shop/products/${r.entity_id}`
  if (r.entity_type === 'shop_category') return `/admin/shop/categories/${r.entity_id}`
  if (r.entity_type === 'page') return `/admin/pages/${r.entity_id}/builder`
  return null
}
const sortIcon = (c: string) => (query.value.sort === c ? (query.value.dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-arrow-up-down')
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="seo-redirects">
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('admin.seo.redirects.search')" :aria-label="t('admin.seo.redirects.search')" class="w-64" />
      <USelect :model-value="query.source ?? 'all'" :items="[{ value: 'all', label: t('admin.seo.redirects.anySource') }, { value: 'auto', label: t('admin.seo.source.auto') }, { value: 'manual', label: t('admin.seo.source.manual') }]" class="w-40" :aria-label="t('admin.seo.redirects.source')" @update:model-value="v => update({ source: v === 'all' ? undefined : v, page: undefined })" />
      <USelect :model-value="query.code ? String(query.code) : 'all'" :items="[{ value: 'all', label: t('admin.seo.redirects.anyCode') }, ...codes.map(c => ({ value: String(c), label: t(`admin.seo.codes.${c}`) }))]" class="w-48" :aria-label="t('admin.seo.redirects.code')" @update:model-value="v => update({ code: v === 'all' ? undefined : v, page: undefined })" />
      <USelect :model-value="query.active === undefined ? 'all' : String(query.active)" :items="[{ value: 'all', label: t('admin.seo.redirects.anyState') }, { value: 'true', label: t('admin.seo.redirects.active') }, { value: 'false', label: t('admin.seo.redirects.inactive') }]" class="w-40" :aria-label="t('admin.seo.redirects.active')" @update:model-value="v => update({ active: v === 'all' ? undefined : v, page: undefined })" />
      <UCheckbox :model-value="!!query.stale" :label="t('admin.seo.redirects.stale')" @update:model-value="v => update({ stale: v ? '1' : undefined, page: undefined })" />
      <UButton v-if="!props.readOnly" class="ms-auto" icon="i-lucide-plus" :label="t('admin.seo.redirects.add')" data-testid="add-redirect" @click="open(null)" />
    </div>
    <div v-if="selected.length && !props.readOnly" class="flex flex-wrap items-center gap-2">
      <span class="text-small text-muted">{{ t('admin.seo.redirects.selected', { n: selected.length }) }}</span>
      <UButton size="sm" color="neutral" variant="outline" :label="t('admin.seo.redirects.activate')" @click="bulk('activate')" />
      <UButton size="sm" color="neutral" variant="outline" :label="t('admin.seo.redirects.deactivate')" @click="bulk('deactivate')" />
      <UButton size="sm" color="error" variant="outline" :label="t('common.delete')" @click="bulk('delete')" />
    </div>
    <div class="overflow-x-auto rounded-md border border-default">
      <table class="w-full text-small" :aria-busy="pending">
        <thead class="bg-elevated text-start">
          <tr>
            <th v-if="!props.readOnly" class="w-8 p-2"><span class="sr-only">{{ t('admin.seo.redirects.select') }}</span></th>
            <th v-for="c in ['from_path', 'to_path', 'status_code']" :key="c" class="p-2 text-start font-medium">
              <button type="button" class="inline-flex items-center gap-1" @click="sortBy(c)">{{ t(`admin.seo.redirects.columns.${c}`) }}<UIcon :name="sortIcon(c)" class="size-3" /></button>
            </th>
            <th class="p-2 text-start font-medium">{{ t('admin.seo.redirects.source') }}</th>
            <th v-for="c in ['hits', 'last_hit_at']" :key="c" class="p-2 text-start font-medium">
              <button type="button" class="inline-flex items-center gap-1" @click="sortBy(c)">{{ t(`admin.seo.redirects.columns.${c}`) }}<UIcon :name="sortIcon(c)" class="size-3" /></button>
            </th>
            <th class="p-2 text-start font-medium">{{ t('admin.seo.redirects.active') }}</th>
            <th class="p-2 text-start font-medium">{{ t('admin.seo.redirects.note') }}</th>
            <th class="p-2"><span class="sr-only">{{ t('admin.seo.redirects.actions') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data?.data ?? []" :key="r.id" class="border-t border-default" :data-testid="`redirect-row-${r.from_path}`">
            <td v-if="!props.readOnly" class="p-2"><UCheckbox :model-value="selected.includes(r.id)" :aria-label="r.from_path" @update:model-value="v => toggle(r.id, !!v)" /></td>
            <td class="max-w-64 truncate p-2 font-mono" dir="ltr" :title="r.from_path">{{ r.from_path }}</td>
            <td class="max-w-64 truncate p-2 font-mono" dir="ltr" :title="r.to_path">{{ r.to_path }}<UBadge v-if="r.to_path.startsWith('https://')" class="ms-1" size="sm" color="warning" variant="soft" :label="t('admin.seo.redirects.external')" /></td>
            <td class="p-2 tabular-nums">{{ r.status_code }}</td>
            <td class="p-2">
              <NuxtLink v-if="contentLink(r)" :to="contentLink(r)!" class="underline">{{ t(`admin.seo.source.${r.source}`) }}</NuxtLink>
              <span v-else>{{ t(`admin.seo.source.${r.source}`) }}</span>
            </td>
            <td class="p-2 tabular-nums">{{ r.hits }}</td>
            <td class="p-2">{{ r.last_hit_at ? date(r.last_hit_at) : '—' }}</td>
            <td class="p-2"><USwitch :model-value="r.is_active" :disabled="props.readOnly" :aria-label="t('admin.seo.redirects.activeFor', { from: r.from_path })" @update:model-value="v => run(() => admin.seo.updateRedirect(r.id, { is_active: v }))" /></td>
            <td class="max-w-48 truncate p-2 text-muted" :title="r.note ?? ''">{{ r.note }}</td>
            <td class="p-2">
              <div v-if="!props.readOnly" class="flex justify-end gap-1">
                <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.seo.redirects.editFor', { from: r.from_path })" @click="open(r)" />
                <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" :aria-label="t('admin.seo.redirects.deleteFor', { from: r.from_path })" @click="remove(r)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <MzEmptyState v-if="!pending && !data?.data.length" icon="i-lucide-corner-down-right" :title="t('admin.seo.redirects.empty')" description="" />
    </div>
    <UPagination v-if="(data?.total ?? 0) > 25" :page="query.page" :total="data?.total ?? 0" :items-per-page="25" @update:page="p => update({ page: String(p) })" />
    <MzSeoRedirectForm v-model:open="drawer" :redirect="editing" :prefill="prefill" :codes="codes" @saved="saved" />
  </div>
</template>
