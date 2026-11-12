<script setup lang="ts">
import type { GuestCategory } from '~/utils/booking-types'
import type { Party } from '~/composables/useBooking'

/**
 * Guests by category (adults, children 4–11, infants 0–3), with the age range under each
 * label and each child's age (age-dependent rules such as an activity's minimum age). Limits
 * are explained inline, never a silent block.
 */
const props = withDefaults(defineProps<{
  categories: GuestCategory[]
  /** Guests counted toward capacity (infants usually not). */
  maxGuests?: number
  maxReason?: string
  askChildAges?: boolean
}>(), { maxGuests: 16, maxReason: undefined, askChildAges: true })

const model = defineModel<Party>({ required: true })
const { t } = useI18n()

const byCode = (code: string) => props.categories.find(c => c.code === code)
const counted = computed(() =>
  (byCode('adult')?.counts_toward_capacity !== false ? model.value.adults : 0)
  + (byCode('child')?.counts_toward_capacity !== false ? model.value.children : 0)
  + (byCode('infant')?.counts_toward_capacity ? model.value.infants : 0))

function field(code: 'adult' | 'child' | 'infant') {
  const key = ({ adult: 'adults', child: 'children', infant: 'infants' } as const)[code]
  const category = byCode(code)
  const room = props.maxGuests - counted.value + model.value[key]
  return {
    key,
    label: category?.name ?? t(`booking.party.${key}`),
    description: category?.description ?? undefined,
    min: code === 'adult' ? 1 : 0,
    max: category?.counts_toward_capacity === false ? 10 : Math.max(code === 'adult' ? 1 : 0, room),
  }
}
const fields = computed(() => (['adult', 'child', 'infant'] as const).filter(c => c === 'adult' || byCode(c)).map(field))

function setCount(key: 'adults' | 'children' | 'infants', value: number) {
  const next = { ...model.value, [key]: value }
  if (key === 'children') next.childAges = Array.from({ length: value }, (_, i) => model.value.childAges[i] ?? defaultChildAge.value)
  model.value = next
}
const childRange = computed(() => {
  const c = byCode('child')
  return { min: c?.min_age ?? 2, max: c?.max_age ?? 17 }
})
const defaultChildAge = computed(() => childRange.value.min)
const ageOptions = computed(() => Array.from({ length: childRange.value.max - childRange.value.min + 1 }, (_, i) => {
  const age = childRange.value.min + i
  return { label: t('booking.party.age', { n: age }, age), value: age }
}))
function setAge(index: number, age: number) {
  const ages = [...model.value.childAges]
  ages[index] = age
  model.value = { ...model.value, childAges: ages }
}
</script>

<template>
  <div class="divide-y divide-default">
    <MzQuantityStepper
      v-for="f in fields"
      :key="f.key"
      :model-value="model[f.key]"
      :label="f.label"
      :description="f.description"
      :min="f.min"
      :max="f.max"
      :max-reason="props.maxReason"
      @update:model-value="setCount(f.key, $event)"
    />
    <div v-if="props.askChildAges && model.children > 0" class="grid gap-3 py-4 sm:grid-cols-2">
      <p class="text-small text-muted sm:col-span-2">{{ t('booking.party.childAgesHelp') }}</p>
      <UFormField v-for="(_, i) in model.children" :key="i" :label="t('booking.party.childAge', { n: i + 1 })">
        <USelect
          :model-value="model.childAges[i] ?? defaultChildAge"
          :items="ageOptions"
          class="w-full"
          @update:model-value="setAge(i, Number($event))"
        />
      </UFormField>
    </div>
  </div>
</template>
