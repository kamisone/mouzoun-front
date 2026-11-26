<script setup lang="ts">
import type { Requirement } from '~/utils/catalog-admin-api'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * "Ressources" tab: what a group needs, as sentences ("1 quad pour 2 participants"), with the
 * active resources of that kind and the resulting maximum per departure; schedules above it
 * are flagged.
 */
const props = defineProps<{ productId: string, canWrite: boolean }>()
const emit = defineEmits<{ max: [n: number | null] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const KINDS = ['vehicle', 'equipment', 'animal', 'guide', 'room', 'other']
const { data, refresh } = await useAsyncData(`catalog-reqs-${props.productId}`, () => api.catalog.requirements(props.productId))
const rows = ref<Requirement[]>([])
watchEffect(() => {
  rows.value = (data.value?.data ?? []).map(r => ({ resource_kind: r.resource_kind, units_per_group: r.units_per_group, participants_per_group: r.participants_per_group }))
  emit('max', data.value?.max_participants ?? null)
})
async function save() {
  try {
    await api.catalog.saveRequirements(props.productId, rows.value)
    toast.add({ title: t('admin.catalog.saved'), color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiError(e).message ?? t('shop.errors.generic'), color: 'error' })
  }
}
const available = (kind: string) => data.value?.data.find(r => r.resource_kind === kind)
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="requirements-panel">
    <div v-for="(r, i) in rows" :key="i" class="flex flex-wrap items-center gap-2 text-small">
      <UInputNumber v-model="r.units_per_group" :min="1" size="xs" class="w-20" :aria-label="t('admin.catalog.resources.units')" />
      <USelect v-model="r.resource_kind" :items="KINDS.map(k => ({ value: k, label: t(`admin.catalog.resources.kinds.${k}`) }))" size="xs" class="w-36" :aria-label="t('admin.catalog.resources.kind')" />
      <span>{{ t('admin.catalog.resources.per') }}</span>
      <UInputNumber v-model="r.participants_per_group" :min="1" size="xs" class="w-20" :aria-label="t('admin.catalog.resources.participants')" />
      <span>{{ t('admin.catalog.resources.participantsWord') }}</span>
      <span v-if="available(r.resource_kind)" class="text-muted">· {{ t('admin.catalog.resources.available', { n: available(r.resource_kind)!.available, max: available(r.resource_kind)!.max_participants }) }}</span>
      <UButton v-if="props.canWrite" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="rows = rows.filter((_, j) => j !== i)" />
    </div>
    <p v-if="data?.max_participants != null" class="text-small font-medium">{{ t('admin.catalog.resources.max', { n: data.max_participants }) }}</p>
    <UAlert v-if="data?.schedules_over.length" color="warning" variant="soft" :title="t('admin.catalog.resources.over', { list: data.schedules_over.map(s => `${s.start_time} (${s.capacity})`).join(', ') })" />
    <div v-if="props.canWrite" class="flex gap-2">
      <UButton :label="t('admin.catalog.resources.add')" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" @click="rows = [...rows, { resource_kind: 'vehicle', units_per_group: 1, participants_per_group: 2 }]" />
      <UButton :label="t('common.save')" size="sm" @click="save" />
      <UButton :label="t('admin.catalog.resources.manage')" to="/admin/catalog/resources" icon="i-lucide-external-link" size="sm" color="neutral" variant="link" />
    </div>
  </div>
</template>
