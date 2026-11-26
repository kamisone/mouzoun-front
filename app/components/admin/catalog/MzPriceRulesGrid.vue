<script setup lang="ts">
import type { CatalogKind, PriceRule, References } from '~/utils/catalog-admin-api'

/**
 * Price rules of a product, one row per rule: rate plan, season, guest category, unit, amount
 * (euros typed, integer cents stored), extra guest (stays), quantities, minimum nights,
 * weekdays (bitmask), validity, priority, active. Rows the engine cannot tell apart (same case,
 * same specificity and priority) are flagged by the API (`ambiguous_with`) and shown in orange.
 */
const props = defineProps<{
  kind: CatalogKind
  allowedUnits: string[]
  refs: References
  readOnly?: boolean
  errors?: Record<string, string>
}>()
const model = defineModel<PriceRule[]>({ required: true })
const { t } = useI18n()
const { name } = useCatalogRefs()
const ALL = '__all__'
const blank = (): PriceRule => ({
  rate_plan_id: null, season_id: null, guest_category_id: null, pricing_unit: props.allowedUnits[0] ?? 'per_person',
  amount_minor: 0, extra_guest_amount_minor: null, min_quantity: 1, max_quantity: null, min_nights: null, days_of_week: 127,
  valid_from: null, valid_to: null, priority: 0, is_active: true,
})
function update(i: number, patch: Partial<PriceRule>) {
  model.value = model.value.map((r, j) => (j === i ? { ...r, ...patch, ambiguous_with: [] } : r))
}
function duplicate(i: number) {
  const copy = { ...model.value[i]!, id: undefined, ambiguous_with: [] }
  model.value = [...model.value.slice(0, i + 1), copy, ...model.value.slice(i + 1)]
}
const options = (list: { id: string, code: string, names: Record<string, string> }[], allLabel: string) =>
  [{ value: ALL, label: allLabel }, ...list.map(x => ({ value: x.id, label: name(x) }))]
const plans = computed(() => options(props.refs.rate_plans, t('admin.catalog.prices.allPlans')))
const seasons = computed(() => options(props.refs.seasons, t('admin.catalog.prices.base')))
const categories = computed(() => options(props.refs.guest_categories, t('admin.catalog.prices.anyGuest')))
const units = computed(() => props.allowedUnits.map(u => ({ value: u, label: t(`admin.catalog.pricingUnits.${u}`) })))
const pick = (v: unknown) => (v === ALL ? null : (v as string))
const err = (i: number, field: string) => props.errors?.[`prices[${i}].${field}`]
const ambiguous = (r: PriceRule) => (r.ambiguous_with?.length ?? 0) > 0
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="price-rules">
    <p v-if="!model.length" class="text-small text-muted">{{ t('admin.catalog.prices.none') }}</p>
    <div
      v-for="(r, i) in model"
      :key="r.id ?? `new-${i}`"
      class="flex flex-col gap-3 rounded-md border p-3"
      :class="ambiguous(r) ? 'border-warning bg-warning/10' : 'border-default'"
      :data-testid="`price-row-${i}`"
    >
      <p v-if="ambiguous(r)" class="text-small text-warning" role="status">{{ t('admin.catalog.prices.ambiguous') }}</p>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField :label="t('admin.catalog.prices.ratePlan')" :name="`plan-${i}`">
          <USelect :model-value="r.rate_plan_id ?? ALL" :items="plans" size="sm" class="w-full" @update:model-value="v => update(i, { rate_plan_id: pick(v) })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.season')" :name="`season-${i}`">
          <USelect :model-value="r.season_id ?? ALL" :items="seasons" size="sm" class="w-full" @update:model-value="v => update(i, { season_id: pick(v) })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.guestCategory')" :name="`guest-${i}`">
          <USelect :model-value="r.guest_category_id ?? ALL" :items="categories" size="sm" class="w-full" @update:model-value="v => update(i, { guest_category_id: pick(v) })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.unit')" :name="`unit-${i}`" :error="err(i, 'pricing_unit') ? t(`admin.catalog.errors.${err(i, 'pricing_unit')}`) : undefined">
          <USelect :model-value="r.pricing_unit" :items="units" size="sm" class="w-full" @update:model-value="v => update(i, { pricing_unit: String(v) })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.amount')" :name="`amount-${i}`" :error="err(i, 'amount_minor') ? t(`admin.catalog.errors.${err(i, 'amount_minor')}`) : undefined">
          <MzMoneyInput :model-value="r.amount_minor" :data-testid="`amount-${i}`" @update:model-value="v => update(i, { amount_minor: v ?? 0 })" />
        </UFormField>
        <UFormField v-if="props.kind === 'stays'" :label="t('admin.catalog.prices.extraGuest')" :name="`extra-${i}`" :hint="t('admin.catalog.prices.extraGuestHint')">
          <MzMoneyInput :model-value="r.extra_guest_amount_minor" @update:model-value="v => update(i, { extra_guest_amount_minor: v })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.minQuantity')" :name="`minq-${i}`">
          <UInputNumber :model-value="r.min_quantity" :min="1" size="sm" class="w-full" @update:model-value="v => update(i, { min_quantity: Number(v) || 1 })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.maxQuantity')" :name="`maxq-${i}`">
          <UInputNumber :model-value="r.max_quantity ?? undefined" :min="1" size="sm" class="w-full" @update:model-value="v => update(i, { max_quantity: v ? Number(v) : null })" />
        </UFormField>
        <UFormField v-if="props.kind === 'stays'" :label="t('admin.catalog.prices.minNights')" :name="`minn-${i}`">
          <UInputNumber :model-value="r.min_nights ?? undefined" :min="1" size="sm" class="w-full" @update:model-value="v => update(i, { min_nights: v ? Number(v) : null })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.validFrom')" :name="`from-${i}`">
          <UInput :model-value="r.valid_from ?? ''" type="date" size="sm" class="w-full" @update:model-value="v => update(i, { valid_from: (v as string) || null })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.validTo')" :name="`to-${i}`" :error="err(i, 'valid_to') ? t(`admin.catalog.errors.${err(i, 'valid_to')}`) : undefined">
          <UInput :model-value="r.valid_to ?? ''" type="date" size="sm" class="w-full" @update:model-value="v => update(i, { valid_to: (v as string) || null })" />
        </UFormField>
        <UFormField :label="t('admin.catalog.prices.priority')" :name="`prio-${i}`" :hint="t('admin.catalog.prices.priorityHint')">
          <UInputNumber :model-value="r.priority" size="sm" class="w-full" @update:model-value="v => update(i, { priority: Number(v) || 0 })" />
        </UFormField>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <MzWeekdayChips :model-value="r.days_of_week" :label="t('admin.catalog.daysOfWeek')" @update:model-value="v => update(i, { days_of_week: v })" />
        <USwitch :model-value="r.is_active" :label="t('admin.catalog.active')" @update:model-value="v => update(i, { is_active: v })" />
        <div v-if="!props.readOnly" class="ms-auto flex gap-1">
          <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.catalog.prices.duplicate')" @click="duplicate(i)" />
          <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="model = model.filter((_, j) => j !== i)" />
        </div>
      </div>
    </div>
    <UButton v-if="!props.readOnly" :label="t('admin.catalog.prices.add')" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" class="self-start" data-testid="add-price" @click="model = [...model, blank()]" />
  </div>
</template>
