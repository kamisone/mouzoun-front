<script setup lang="ts">
import type { BookingRef, Unit } from '~/utils/catalog-admin-api'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * "Unités" tab of a stay: unit mode = numbered pitches or tents (table, inline add, bulk
 * create "P-01 à P-12", reorder, status), pool mode = one capacity. Every change is saved at
 * once (inventory.write); a change that would leave a night below its bookings is refused and
 * the bookings are listed. Bookings are never moved or cancelled from here.
 */
const props = defineProps<{ productId: string, canWrite: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const { data, refresh } = await useAsyncData(`catalog-units-${props.productId}`, () => api.catalog.units(props.productId))
const rows = ref<Unit[]>([])
watchEffect(() => { rows.value = (data.value?.data ?? []).map(u => ({ ...u })) })
const blocked = ref<{ message: string, bookings: BookingRef[] } | null>(null)
async function run(fn: () => Promise<unknown>, ok?: string) {
  blocked.value = null
  try {
    await fn()
    if (ok) toast.add({ title: ok, color: 'success' })
    await refresh()
    emit('changed')
    return true
  }
  catch (e) {
    const err = apiError(e)
    if (err.details?.bookings) blocked.value = { message: t(`admin.catalog.errors.${err.code}`), bookings: err.details.bookings }
    else toast.add({ title: err.code ? t(`admin.catalog.errors.${err.code}`, err.message ?? '') : t('shop.errors.generic'), color: 'error' })
    await refresh()
    return false
  }
}
const mode = computed(() => data.value?.inventory_mode ?? 'unit')
const pool = ref<number>(0)
watchEffect(() => { pool.value = data.value?.pool_capacity ?? 0 })
const newUnit = reactive({ code: '', name: '' })
const bulk = reactive({ prefix: 'P-', from: 1, to: 12 })
const STATUSES = ['active', 'maintenance', 'retired'] as const
function move(i: number, by: number) {
  const next = [...rows.value]
  const j = i + by
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  rows.value = next
  run(() => api.catalog.reorderUnits(props.productId, next.map(u => u.id)))
}
const saveUnit = (u: Unit) => run(() => api.catalog.updateUnit(props.productId, u.id, { code: u.code, name: u.name, place_id: u.place_id, status: u.status, latitude: u.latitude, longitude: u.longitude, notes: u.notes }), t('admin.catalog.saved'))
const switchMode = (to: 'unit' | 'pool') => run(() => api.catalog.setInventory(props.productId, { inventory_mode: to, pool_capacity: to === 'pool' ? pool.value : null }), t('admin.catalog.saved'))
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="units-panel">
    <MzBlockedBookings v-if="blocked" :message="blocked.message" :bookings="blocked.bookings" />
    <URadioGroup
      :model-value="mode"
      :items="[{ value: 'unit', label: t('admin.catalog.units.modeUnit'), description: t('admin.catalog.units.modeUnitHint') }, { value: 'pool', label: t('admin.catalog.units.modePool'), description: t('admin.catalog.units.modePoolHint') }]"
      :disabled="!props.canWrite"
      :legend="t('admin.catalog.units.mode')"
      @update:model-value="v => switchMode(v as 'unit' | 'pool')"
    />
    <div v-if="mode === 'pool'" class="flex flex-wrap items-end gap-2">
      <UFormField :label="t('admin.catalog.units.poolCapacity')" name="pool-capacity" :help="t('admin.catalog.units.poolCapacityHint')">
        <UInputNumber v-model="pool" :min="0" :disabled="!props.canWrite" />
      </UFormField>
      <UButton v-if="props.canWrite" :label="t('common.save')" size="sm" data-testid="save-pool" @click="switchMode('pool')" />
    </div>
    <template v-else>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[48rem] text-small">
          <thead>
            <tr class="text-muted">
              <th class="p-1 text-start">{{ t('admin.catalog.units.code') }}</th><th class="p-1 text-start">{{ t('admin.catalog.units.name') }}</th>
              <th class="p-1 text-start">{{ t('admin.catalog.units.zone') }}</th><th class="p-1 text-start">{{ t('admin.catalog.units.status') }}</th>
              <th class="p-1 text-start">{{ t('admin.catalog.units.coordinates') }}</th><th class="p-1 text-start">{{ t('admin.catalog.units.notes') }}</th><th class="p-1" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(u, i) in rows" :key="u.id" class="border-t border-default" :data-testid="`unit-${u.code}`">
              <td class="p-1"><UInput v-model="u.code" size="xs" class="w-24" dir="ltr" :aria-label="t('admin.catalog.units.code')" /></td>
              <td class="p-1"><UInput :model-value="u.name ?? ''" size="xs" class="w-32" :aria-label="t('admin.catalog.units.name')" @update:model-value="v => (u.name = String(v) || null)" /></td>
              <td class="p-1 w-48"><MzEntityPicker :model-value="u.place_id ?? undefined" kind="place" :label="t('admin.catalog.units.zone')" @update:model-value="v => (u.place_id = (v as string) ?? null)" /></td>
              <td class="p-1"><USelect v-model="u.status" :items="STATUSES.map(s => ({ value: s, label: t(`admin.catalog.units.statuses.${s}`) }))" size="xs" class="w-32" :aria-label="t('admin.catalog.units.status')" /></td>
              <td class="p-1"><div class="flex gap-1"><UInput :model-value="u.latitude ?? ''" size="xs" class="w-24" dir="ltr" placeholder="31.2389" :aria-label="t('admin.catalog.units.latitude')" @update:model-value="v => (u.latitude = String(v) || null)" /><UInput :model-value="u.longitude ?? ''" size="xs" class="w-24" dir="ltr" placeholder="-4.7013" :aria-label="t('admin.catalog.units.longitude')" @update:model-value="v => (u.longitude = String(v) || null)" /></div></td>
              <td class="p-1"><UInput :model-value="u.notes ?? ''" size="xs" class="w-40" :aria-label="t('admin.catalog.units.notes')" @update:model-value="v => (u.notes = String(v) || null)" /></td>
              <td class="p-1">
                <div v-if="props.canWrite" class="flex gap-1">
                  <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, -1)" />
                  <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === rows.length - 1" :aria-label="t('admin.catalog.moveDown')" @click="move(i, 1)" />
                  <UButton icon="i-lucide-save" size="xs" color="neutral" variant="ghost" :aria-label="t('common.save')" :data-testid="`save-unit-${u.code}`" @click="saveUnit(u)" />
                  <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="run(() => api.catalog.deleteUnit(props.productId, u.id), t('admin.catalog.deleted'))" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="text-small text-muted">{{ t('admin.catalog.units.none') }}</p>
      <div v-if="props.canWrite" class="flex flex-wrap items-end gap-2">
        <UFormField :label="t('admin.catalog.units.code')" name="new-unit-code"><UInput v-model="newUnit.code" size="sm" class="w-28" dir="ltr" data-testid="new-unit-code" /></UFormField>
        <UFormField :label="t('admin.catalog.units.name')" name="new-unit-name"><UInput v-model="newUnit.name" size="sm" class="w-40" /></UFormField>
        <UButton :label="t('admin.catalog.units.add')" icon="i-lucide-plus" size="sm" :disabled="!newUnit.code.trim()" data-testid="add-unit" @click="run(() => api.catalog.createUnit(props.productId, { code: newUnit.code, name: newUnit.name || null }), t('admin.catalog.saved')).then(ok => ok && Object.assign(newUnit, { code: '', name: '' }))" />
      </div>
      <div v-if="props.canWrite" class="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-default p-3">
        <UFormField :label="t('admin.catalog.units.prefix')" name="bulk-prefix"><UInput v-model="bulk.prefix" size="sm" class="w-20" dir="ltr" /></UFormField>
        <UFormField :label="t('admin.catalog.units.from')" name="bulk-from"><UInputNumber v-model="bulk.from" :min="0" size="sm" class="w-24" /></UFormField>
        <UFormField :label="t('admin.catalog.units.to')" name="bulk-to"><UInputNumber v-model="bulk.to" :min="bulk.from" size="sm" class="w-24" /></UFormField>
        <UButton
          :label="t('admin.catalog.units.bulk', { first: `${bulk.prefix}${String(bulk.from).padStart(2, '0')}`, last: `${bulk.prefix}${String(bulk.to).padStart(2, '0')}` })"
          size="sm" color="neutral" variant="outline" data-testid="bulk-units"
          @click="run(() => api.catalog.bulkUnits(props.productId, { prefix: bulk.prefix, from: bulk.from, to: bulk.to }), t('admin.catalog.saved'))"
        />
      </div>
    </template>
  </div>
</template>
