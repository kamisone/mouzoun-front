<script setup lang="ts">
import { type CalendarDate, parseDate } from '@internationalized/date'

/**
 * Arrival / departure picker. v-model `{ start: '2027-01-15', end: '2027-01-17' }` (calendar
 * dates, like the API). Calendar labels follow the language; layout follows the direction.
 */
export interface DateRangeValue { start: string | null, end: string | null }

const props = withDefaults(defineProps<{
  /** First selectable date, YYYY-MM-DD. */
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
}>(), { min: undefined, max: undefined, placeholder: undefined, disabled: false })

const model = defineModel<DateRangeValue>({ default: () => ({ start: null, end: null }) })
const { t } = useI18n()
const { size } = useDensity()

const calendarValue = computed({
  get: () => ({
    start: model.value.start ? parseDate(model.value.start) : undefined,
    end: model.value.end ? parseDate(model.value.end) : undefined,
  }),
  set: (value: { start?: CalendarDate | null, end?: CalendarDate | null } | null) => {
    model.value = { start: value?.start?.toString() ?? null, end: value?.end?.toString() ?? null }
  },
})
const minValue = computed(() => (props.min ? parseDate(props.min) : undefined))
const maxValue = computed(() => (props.max ? parseDate(props.max) : undefined))
</script>

<template>
  <UPopover>
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      :size="size"
      :disabled="props.disabled"
      class="w-full justify-start"
    >
      <MzDate v-if="model.start && model.end" :value="model.start" :end="model.end" />
      <span v-else class="text-dimmed">{{ props.placeholder ?? t('forms.selectDates') }}</span>
    </UButton>
    <template #content>
      <UCalendar
        v-model="calendarValue"
        range
        :number-of-months="2"
        :min-value="minValue"
        :max-value="maxValue"
        class="p-2"
      />
    </template>
  </UPopover>
</template>
