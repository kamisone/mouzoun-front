<script setup lang="ts">
import type { NotFoundRow } from '~/utils/seo-admin-api'

/**
 * Erreurs 404: missing addresses visitors asked for, most visited first, with the three closest
 * live addresses of the same language. Create a redirect (prefilled), ignore, or clear a row.
 */
const props = defineProps<{ readOnly: boolean }>()
const emit = defineEmits<{ create: [from: string, to?: string] }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminApi()
const toast = useToast()
const { date } = useDate()
const query = computed(() => ({ ignored: route.query.ignored === '1' || undefined, q: (route.query.q as string) || undefined, page: Number(route.query.page ?? 1) || 1, per_page: 25 }))
const { data, refresh, pending } = await useAsyncData(() => `seo-404-${JSON.stringify(query.value)}`, () => admin.seo.notFound(query.value), { watch: [query] })
const update = (patch: Record<string, string | undefined>) => router.replace({ query: Object.fromEntries(Object.entries({ ...route.query, ...patch }).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string> })
async function run(fn: () => Promise<unknown>, done: string) {
  try {
    await fn()
    toast.add({ title: done, color: 'success' })
    await refresh()
  }
  catch {
    toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
}
const ignore = (r: NotFoundRow) => run(() => admin.seo.ignoreNotFound(r.path, !r.is_ignored), r.is_ignored ? t('admin.seo.notFound.restored') : t('admin.seo.notFound.ignoredDone'))
const clear = (r: NotFoundRow) => run(() => admin.seo.clearNotFound([r.path]), t('admin.seo.notFound.cleared'))
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="seo-not-found">
    <div class="flex flex-wrap items-center gap-2">
      <UInput :model-value="query.q ?? ''" icon="i-lucide-search" :placeholder="t('admin.seo.notFound.search')" :aria-label="t('admin.seo.notFound.search')" class="w-64" @update:model-value="v => update({ q: String(v) || undefined, page: undefined })" />
      <UCheckbox :model-value="!!query.ignored" :label="t('admin.seo.notFound.showIgnored')" @update:model-value="v => update({ ignored: v ? '1' : undefined, page: undefined })" />
    </div>
    <ul class="flex flex-col rounded-md border border-default" :aria-busy="pending">
      <li v-for="r in data?.data ?? []" :key="r.path" class="flex flex-col gap-2 border-t border-default p-3 first:border-t-0" :data-testid="`not-found-${r.path}`">
        <div class="flex flex-wrap items-center gap-3">
          <span class="min-w-0 flex-1 truncate font-mono text-small" dir="ltr" :title="r.path">{{ r.path }}</span>
          <UBadge v-if="r.is_ignored" color="neutral" variant="soft" :label="t('admin.seo.notFound.ignored')" />
          <span class="text-small tabular-nums">{{ t('admin.seo.notFound.visits', { n: r.hits }, r.hits) }}</span>
        </div>
        <p class="text-caption text-muted">
          {{ t('admin.seo.notFound.seen', { first: date(r.first_seen_at), last: date(r.last_seen_at) }) }}
          <template v-if="r.last_referrer"> · {{ t('admin.seo.notFound.referrer') }} <span dir="ltr">{{ r.last_referrer }}</span></template>
        </p>
        <div v-if="r.suggestions.length" class="flex flex-wrap items-center gap-2 text-small">
          <span class="text-muted">{{ t('admin.seo.notFound.suggestions') }}</span>
          <UButton v-for="s in r.suggestions" :key="s.path" size="xs" color="neutral" variant="outline" class="font-mono" :disabled="props.readOnly" :label="s.path" :aria-label="t('admin.seo.notFound.redirectTo', { to: s.path })" @click="emit('create', r.path, s.path)" />
        </div>
        <div v-if="!props.readOnly" class="flex flex-wrap gap-2">
          <UButton size="xs" icon="i-lucide-corner-down-right" :label="t('admin.seo.notFound.create')" @click="emit('create', r.path, r.suggestions[0]?.path)" />
          <UButton size="xs" color="neutral" variant="ghost" :label="r.is_ignored ? t('admin.seo.notFound.restore') : t('admin.seo.notFound.ignore')" @click="ignore(r)" />
          <UButton size="xs" color="neutral" variant="ghost" :label="t('admin.seo.notFound.clear')" @click="clear(r)" />
        </div>
      </li>
    </ul>
    <MzEmptyState v-if="!pending && !data?.data.length" icon="i-lucide-circle-check" :title="t('admin.seo.notFound.empty')" description="" />
    <UPagination v-if="(data?.total ?? 0) > 25" :page="query.page" :total="data?.total ?? 0" :items-per-page="25" @update:page="p => update({ page: String(p) })" />
  </div>
</template>
