<script setup lang="ts">
import type { PackageItem } from '~/utils/catalog-admin-api'
import { PACKAGE_ITEM_KINDS, packageItemErrors } from '~/utils/catalog'

/**
 * "Contenu" tab of a package: stays, activities and extras (never a package or a shop
 * product), quantity (nights for the stay), day, optional, order. The same rules as the API
 * are shown as you edit (one stay at most, its nights = the package nights, days within the
 * duration); each item shows its status and its price on a sample date.
 */
const props = defineProps<{
  durationDays: number | null
  durationNights: number | null
  /** Items as loaded (with name, status, sample price) by product id. */
  known: Record<string, PackageItem>
  sampleDate?: string
  apiErrors?: Record<string, string>
}>()
const model = defineModel<PackageItem[]>({ required: true })
const { t } = useI18n()
const { money } = useMoney()
const toAdd = ref<string | undefined>(undefined)
const api = useAdminApi()
async function add(id: string | undefined) {
  if (!id) return
  const found = (await api.lookup('product', { ids: [id], kinds: PACKAGE_ITEM_KINDS })).options[0]
  const kind = found?.hint?.split(' · ')[0]
  model.value = [...model.value, { item_product_id: id, quantity: kind === 'accommodation' ? (props.durationNights ?? 1) : 1, day_number: 1, is_optional: false, kind, name: found?.label }]
  toAdd.value = undefined
}
const errors = computed(() => ({ ...packageItemErrors(model.value.map(i => ({ ...i, kind: i.kind ?? props.known[i.item_product_id]?.kind })), props.durationDays, props.durationNights), ...(props.apiErrors ?? {}) }))
const err = (i: number, field: string) => errors.value[`items[${i}].${field}`]
function move(i: number, by: number) {
  const next = [...model.value]
  const j = i + by
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  model.value = next
}
const info = (it: PackageItem) => ({ ...props.known[it.item_product_id], ...it })
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="package-items">
    <UAlert v-if="errors['details.duration_nights']" color="warning" variant="soft" :title="t('admin.catalog.errors.required_with_stay')" />
    <div v-for="(it, i) in model" :key="`${it.item_product_id}-${i}`" class="flex flex-col gap-2 rounded-md border border-default p-3" :data-testid="`item-${i}`">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium">{{ info(it).name ?? it.item_product_id }}</span>
        <UBadge v-if="info(it).kind" :label="t(`admin.catalog.kinds.${info(it).kind}`)" size="sm" color="neutral" variant="outline" />
        <UBadge v-if="info(it).status" :label="t(`admin.catalog.statuses.${info(it).status}`)" size="sm" :color="info(it).status === 'published' ? 'success' : 'warning'" variant="soft" />
        <span v-if="info(it).sample_price_minor != null" class="text-small text-muted">{{ t('admin.catalog.items.samplePrice', { price: money(info(it).sample_price_minor!), date: props.sampleDate ?? '' }) }}</span>
        <div class="ms-auto flex gap-1">
          <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, -1)" />
          <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === model.length - 1" :aria-label="t('admin.catalog.moveDown')" @click="move(i, 1)" />
          <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="model = model.filter((_, j) => j !== i)" />
        </div>
      </div>
      <p v-if="err(i, 'item_product_id')" class="text-small text-error" role="alert">{{ t(`admin.catalog.errors.${err(i, 'item_product_id')}`) }}</p>
      <div class="flex flex-wrap items-end gap-2">
        <UFormField :label="info(it).kind === 'accommodation' ? t('admin.catalog.items.nights') : t('admin.catalog.items.quantity')" :name="`qty-${i}`" :error="err(i, 'quantity') ? t(`admin.catalog.errors.${err(i, 'quantity')}`) : undefined">
          <UInputNumber v-model="it.quantity" :min="1" size="sm" class="w-24" />
        </UFormField>
        <UFormField :label="t('admin.catalog.items.day')" :name="`day-${i}`" :error="err(i, 'day_number') ? t(`admin.catalog.errors.${err(i, 'day_number')}`) : undefined">
          <UInputNumber :model-value="it.day_number ?? undefined" :min="1" :max="props.durationDays ?? undefined" size="sm" class="w-24" @update:model-value="v => (it.day_number = v ? Number(v) : null)" />
        </UFormField>
        <USwitch v-model="it.is_optional" :label="t('admin.catalog.items.optional')" class="mb-2" />
      </div>
    </div>
    <p v-if="!model.length" class="text-small text-muted">{{ t('admin.catalog.items.none') }}</p>
    <MzEntityPicker :model-value="toAdd" kind="product" :kinds="PACKAGE_ITEM_KINDS" :label="t('admin.catalog.items.add')" @update:model-value="v => add(v as string | undefined)" />
  </div>
</template>
