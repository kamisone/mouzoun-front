<script setup lang="ts">
import type { BookingRef, CatalogSlot } from '~/utils/catalog-admin-api'
import { addDays } from '~/utils/catalog'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * "Départs" tab: upcoming departures with capacity, bookings, status, guide and language.
 * Change the capacity (never below the bookings), close or reopen, cancel (only without
 * bookings: otherwise the bookings are listed with a link), assign a guide, add a one-off
 * departure.
 */
const props = defineProps<{ productId: string, canWrite: boolean }>()
const emit = defineEmits<{ loaded: [slots: CatalogSlot[]] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const days = ref(14)
const { data, refresh } = await useAsyncData(`catalog-slots-${props.productId}`, () => {
  const from = new Date()
  const to = new Date(from.getTime() + days.value * 86_400_000)
  return api.catalog.slots(props.productId, from.toISOString(), to.toISOString())
}, { watch: [days] })
watchEffect(() => emit('loaded', data.value?.data ?? []))
const { data: guides } = await useAsyncData('catalog-guides', () => api.catalog.guides())
const blocked = ref<{ message: string, bookings: BookingRef[] } | null>(null)
async function patch(s: CatalogSlot, body: Parameters<typeof api.catalog.patchSlot>[1]) {
  blocked.value = null
  try {
    await api.catalog.patchSlot(s.id, body)
    toast.add({ title: t('admin.catalog.saved'), color: 'success' })
  }
  catch (e) {
    const err = apiError(e)
    if (err.details?.bookings) blocked.value = { message: t(`admin.catalog.errors.${err.code}`), bookings: err.details.bookings }
    else toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
  await refresh()
}
const today = new Date().toISOString().slice(0, 10)
const oneOff = reactive({ date: addDays(today, 1), time: '09:00', capacity: 8 })
async function add() {
  try {
    await api.catalog.createSlot(props.productId, { ...oneOff })
    toast.add({ title: t('admin.catalog.saved'), color: 'success' })
    await refresh()
  }
  catch (e) {
    const err = apiError(e)
    toast.add({ title: err.code ? t(`admin.catalog.errors.${Object.values(err.details?.fields ?? {})[0] ?? err.code}`) : t('shop.errors.generic'), color: 'error' })
  }
}
const statusColor = (s: string) => (s === 'open' ? 'success' : s === 'full' ? 'warning' : s === 'cancelled' ? 'error' : 'neutral')
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="departures-panel">
    <div class="flex items-center gap-2">
      <USelect v-model="days" :items="[7, 14, 30, 60].map(n => ({ value: n, label: t('admin.catalog.departures.nextDays', { n }) }))" size="sm" class="w-48" :aria-label="t('admin.catalog.departures.window')" />
      <UButton icon="i-lucide-refresh-cw" size="sm" color="neutral" variant="ghost" :aria-label="t('admin.refresh')" @click="refresh()" />
    </div>
    <MzBlockedBookings v-if="blocked" :message="blocked.message" :bookings="blocked.bookings" />
    <div class="overflow-x-auto">
      <table class="w-full min-w-[48rem] text-small">
        <thead>
          <tr class="text-muted">
            <th class="p-1 text-start">{{ t('admin.catalog.departures.when') }}</th><th class="p-1 text-start">{{ t('admin.catalog.departures.capacity') }}</th>
            <th class="p-1 text-start">{{ t('admin.catalog.departures.booked') }}</th><th class="p-1 text-start">{{ t('admin.catalog.departures.status') }}</th>
            <th class="p-1 text-start">{{ t('admin.catalog.departures.guide') }}</th><th class="p-1" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in data?.data ?? []" :key="s.id" class="border-t border-default" :data-testid="`slot-${s.local}`">
            <td class="p-1 tabular-nums">{{ s.local }}<UBadge v-if="!s.schedule_id" :label="t('admin.catalog.departures.oneOff')" size="sm" color="neutral" variant="outline" class="ms-1" /></td>
            <td class="p-1">
              <UInputNumber :model-value="s.capacity" :min="s.reserved" size="xs" class="w-24" :disabled="!props.canWrite" :aria-label="t('admin.catalog.departures.capacity')" @update:model-value="v => v != null && v !== s.capacity && patch(s, { capacity: Number(v) })" />
            </td>
            <td class="p-1 tabular-nums">{{ s.reserved }} · {{ t('admin.catalog.departures.left', { n: s.available }) }}</td>
            <td class="p-1"><UBadge :label="t(`admin.catalog.departures.statuses.${s.status}`)" :color="statusColor(s.status)" variant="soft" size="sm" /></td>
            <td class="p-1">
              <div class="flex gap-1">
                <USelect :model-value="s.guide_user_id ?? undefined" :items="[{ value: undefined, label: '—' }, ...(guides?.data ?? []).map(g => ({ value: g.id, label: g.name }))]" size="xs" class="w-36" :disabled="!props.canWrite" :aria-label="t('admin.catalog.departures.guide')" @update:model-value="v => patch(s, { guide_user_id: (v as string) ?? null })" />
                <USelect :model-value="s.guide_language ?? undefined" :items="[{ value: undefined, label: '—' }, ...['fr', 'en', 'ar'].map(l => ({ value: l, label: l.toUpperCase() }))]" size="xs" class="w-20" :disabled="!props.canWrite" :aria-label="t('admin.catalog.departures.language')" @update:model-value="v => patch(s, { guide_language: (v as string) ?? null })" />
              </div>
            </td>
            <td class="p-1">
              <div v-if="props.canWrite" class="flex gap-1">
                <UButton v-if="s.status === 'closed'" :label="t('admin.catalog.departures.reopen')" size="xs" color="neutral" variant="outline" @click="patch(s, { status: 'open' })" />
                <UButton v-else-if="s.status !== 'cancelled'" :label="t('admin.catalog.departures.close')" size="xs" color="neutral" variant="outline" @click="patch(s, { status: 'closed' })" />
                <UButton v-if="s.status !== 'cancelled'" :label="t('admin.catalog.departures.cancel')" size="xs" color="error" variant="ghost" :data-testid="`cancel-slot-${s.local}`" @click="patch(s, { status: 'cancelled' })" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!(data?.data ?? []).length" class="text-small text-muted">{{ t('admin.catalog.departures.none') }}</p>
    </div>
    <div v-if="props.canWrite" class="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-default p-3">
      <UFormField :label="t('admin.catalog.simulator.date')" name="one-off-date"><UInput v-model="oneOff.date" type="date" size="sm" /></UFormField>
      <UFormField :label="t('admin.catalog.schedules.start')" name="one-off-time"><UInput v-model="oneOff.time" type="time" size="sm" /></UFormField>
      <UFormField :label="t('admin.catalog.departures.capacity')" name="one-off-capacity"><UInputNumber v-model="oneOff.capacity" :min="1" size="sm" class="w-24" /></UFormField>
      <UButton :label="t('admin.catalog.departures.addOneOff')" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" @click="add" />
    </div>
  </div>
</template>
