<script setup lang="ts">
import type { Schedule, SlotSync } from '~/utils/catalog-admin-api'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * "Horaires" tab (fixed departures): recurring schedules (weekdays, start time in camp time,
 * capacity, validity, active) with a preview of the next 14 departures they create. Saving
 * regenerates the future departures; departures with bookings are never changed and are listed.
 */
const props = defineProps<{ productId: string, canWrite: boolean, maxParticipants?: number | null }>()
const emit = defineEmits<{ saved: [sync: SlotSync] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const { dateTime } = useDate()
const today = new Date().toISOString().slice(0, 10)
const { data } = await useAsyncData(`catalog-schedules-${props.productId}`, () => api.catalog.schedules(props.productId))
const rows = ref<Schedule[]>([])
watchEffect(() => { rows.value = (data.value?.data ?? []).map(s => ({ ...s })) })
const blank = (): Schedule => ({ days_of_week: 127, start_time: '09:00', capacity: props.maxParticipants ?? 8, valid_from: today, valid_to: null, is_active: true })
const preview = ref<{ starts_at: string, local: string, capacity: number }[]>([])
const previewError = ref('')
async function refreshPreview() {
  previewError.value = ''
  try {
    preview.value = (await api.catalog.previewSchedules(props.productId, rows.value)).data
  }
  catch (e) {
    preview.value = []
    previewError.value = apiError(e).code ? t('admin.catalog.schedules.invalid') : t('shop.errors.generic')
  }
}
watchDebounced(rows, refreshPreview, { debounce: 400, deep: true, immediate: true })
const saving = ref(false)
const report = ref<SlotSync | null>(null)
async function save() {
  saving.value = true
  try {
    report.value = await api.catalog.saveSchedules(props.productId, rows.value)
    toast.add({ title: t('admin.catalog.schedules.saved', { created: report.value.created, deleted: report.value.deleted }), color: 'success' })
    rows.value = (await api.catalog.schedules(props.productId)).data
    emit('saved', report.value)
  }
  catch (e) {
    toast.add({ title: apiError(e).message ?? t('shop.errors.generic'), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="schedules-panel">
    <div v-for="(s, i) in rows" :key="s.id ?? `new-${i}`" class="flex flex-col gap-2 rounded-md border border-default p-3" :data-testid="`schedule-${i}`">
      <div class="flex flex-wrap items-end gap-2">
        <UFormField :label="t('admin.catalog.schedules.start')" :name="`start-${i}`"><UInput v-model="s.start_time" type="time" size="sm" class="w-28" /></UFormField>
        <UFormField :label="t('admin.catalog.schedules.capacity')" :name="`cap-${i}`" :error="props.maxParticipants && s.capacity > props.maxParticipants ? t('admin.catalog.schedules.overResources', { max: props.maxParticipants }) : undefined">
          <UInputNumber v-model="s.capacity" :min="1" size="sm" class="w-28" />
        </UFormField>
        <UFormField :label="t('admin.catalog.schedules.from')" :name="`from-${i}`"><UInput v-model="s.valid_from" type="date" size="sm" /></UFormField>
        <UFormField :label="t('admin.catalog.schedules.to')" :name="`to-${i}`"><UInput :model-value="s.valid_to ?? ''" type="date" size="sm" @update:model-value="v => (s.valid_to = (v as string) || null)" /></UFormField>
        <USwitch v-model="s.is_active" :label="t('admin.catalog.active')" class="mb-2" />
        <UButton v-if="props.canWrite" icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" class="mb-2 ms-auto" :aria-label="t('common.delete')" @click="rows = rows.filter((_, j) => j !== i)" />
      </div>
      <MzWeekdayChips v-model="s.days_of_week" />
    </div>
    <div v-if="props.canWrite" class="flex flex-wrap gap-2">
      <UButton :label="t('admin.catalog.schedules.add')" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" data-testid="add-schedule" @click="rows = [...rows, blank()]" />
      <UButton :label="t('admin.catalog.schedules.save')" icon="i-lucide-save" size="sm" :loading="saving" data-testid="save-schedules" @click="save" />
    </div>
    <section class="flex flex-col gap-1" :aria-label="t('admin.catalog.schedules.preview')" data-testid="schedule-preview">
      <h3 class="font-medium">{{ t('admin.catalog.schedules.preview') }}</h3>
      <p v-if="previewError" class="text-small text-error">{{ previewError }}</p>
      <p v-else-if="!preview.length" class="text-small text-muted">{{ t('admin.catalog.schedules.noPreview') }}</p>
      <ol class="grid gap-1 text-small sm:grid-cols-2">
        <li v-for="p in preview" :key="p.starts_at" class="tabular-nums">{{ p.local }} · {{ t('admin.catalog.schedules.places', { n: p.capacity }) }}</li>
      </ol>
    </section>
    <UAlert v-if="report?.kept_booked.length" color="warning" variant="soft" icon="i-lucide-alert-triangle" :title="t('admin.catalog.schedules.keptBooked', { n: report.kept_booked.length })">
      <template #description>
        <ul class="mt-1 text-small"><li v-for="k in report.kept_booked" :key="k.slot_id">{{ dateTime(k.starts_at) }} · {{ t('admin.catalog.schedules.reserved', { n: k.reserved }) }}</li></ul>
      </template>
    </UAlert>
  </div>
</template>
