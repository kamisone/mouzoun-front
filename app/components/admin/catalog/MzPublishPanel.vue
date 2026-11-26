<script setup lang="ts">
import type { CatalogProduct, Checklist } from '~/utils/catalog-admin-api'

/**
 * Status column of the editor: the status, the publish checklist (blocking lines first, then
 * warnings that never block) and the status actions. A product with bookings cannot be
 * deleted: the button becomes "Archiver". A product a published package or a mandatory extra
 * depends on lists them instead of leaving the site.
 */
const props = defineProps<{ product: CatalogProduct, checklist: Checklist | null, canWrite: boolean, busy?: boolean }>()
const emit = defineEmits<{ publish: [], unpublish: [], archive: [], delete: [] }>()
const { t } = useI18n()
const { dateTime } = useDate()
const blocking = computed(() => props.checklist?.blocking ?? [])
const ready = computed(() => blocking.value.every(c => c.ok))
const dependants = computed(() => [
  ...props.product.used_in.packages.filter(p => p.status === 'published').map(p => ({ ...p, to: `/admin/catalog/packages/${p.id}` })),
  ...props.product.used_in.mandatory_extra_of.map(p => ({ ...p, to: p.segment ? `/admin/catalog/${p.segment}/${p.id}` : undefined })),
])
const color = (s: string) => (s === 'published' ? 'success' : s === 'archived' ? 'neutral' : 'warning')
</script>

<template>
  <section class="flex flex-col gap-3 rounded-md border border-default p-4" :aria-label="t('admin.catalog.status')" data-testid="publish-panel">
    <div class="flex items-center gap-2">
      <span class="text-small text-muted">{{ t('admin.catalog.status') }}</span>
      <UBadge :label="t(`admin.catalog.statuses.${props.product.status}`)" :color="color(props.product.status)" variant="soft" data-testid="status-badge" />
    </div>
    <p v-if="props.product.published_at" class="text-caption text-muted">{{ t('admin.catalog.publishedAt', { date: dateTime(props.product.published_at) }) }}</p>
    <div v-if="props.checklist && props.product.status !== 'published'" class="flex flex-col gap-1" data-testid="publish-checklist">
      <p class="text-small font-medium">{{ t('admin.catalog.checklist.title') }}</p>
      <ul class="flex flex-col gap-1 text-small">
        <li v-for="c in blocking" :key="c.code" class="flex items-start gap-2" :data-ok="c.ok">
          <UIcon :name="c.ok ? 'i-lucide-check' : 'i-lucide-x'" :class="c.ok ? 'text-success' : 'text-error'" class="mt-1 shrink-0" />
          <span :class="c.ok ? 'text-muted' : ''">{{ t(`admin.catalog.checklist.items.${c.code}`) }}</span>
        </li>
        <li v-for="c in props.checklist.warnings.filter(w => !w.ok)" :key="c.code" class="flex items-start gap-2">
          <UIcon name="i-lucide-alert-triangle" class="mt-1 shrink-0 text-warning" />
          <span class="text-muted">{{ t(`admin.catalog.checklist.warnings.${c.code}`) }}</span>
        </li>
      </ul>
    </div>
    <UAlert v-if="dependants.length && props.product.status === 'published'" color="neutral" variant="soft" icon="i-lucide-link" :title="t('admin.catalog.usedIn', { n: dependants.length })">
      <template #description>
        <ul class="mt-1 text-small"><li v-for="d in dependants" :key="d.id"><ULink :to="d.to" class="underline">{{ d.name }}</ULink></li></ul>
      </template>
    </UAlert>
    <div v-if="props.canWrite" class="flex flex-wrap gap-2">
      <UButton v-if="props.product.status !== 'published'" :label="t('admin.catalog.publish')" icon="i-lucide-globe" :disabled="!ready" :loading="props.busy" data-testid="publish" @click="emit('publish')" />
      <UButton v-if="props.product.status === 'published'" :label="t('admin.catalog.unpublish')" color="neutral" variant="outline" :loading="props.busy" data-testid="unpublish" @click="emit('unpublish')" />
      <UButton v-if="props.product.status !== 'archived'" :label="t('admin.catalog.archive')" color="neutral" variant="ghost" :loading="props.busy" data-testid="archive" @click="emit('archive')" />
      <UButton v-if="!props.product.booked" :label="t('common.delete')" color="error" variant="ghost" data-testid="delete" @click="emit('delete')" />
    </div>
    <p v-if="props.product.booked && props.canWrite" class="text-caption text-muted">{{ t('admin.catalog.bookedNoDelete') }}</p>
  </section>
</template>
