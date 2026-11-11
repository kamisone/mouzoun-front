<script setup lang="ts">
import type { DateInput, DateStyle } from '~/utils/i18n-format'

/** A date, date-time or range in the current locale (camp time zone), in a <time> element. */
const props = withDefaults(defineProps<{
  value: DateInput
  /** Makes a range ("15–17 janvier 2027"). */
  end?: DateInput
  withTime?: boolean
  dateStyle?: DateStyle
}>(), { end: undefined, withTime: false, dateStyle: 'long' })

const { date, dateTime, dateRange } = useDate()
const iso = (v: DateInput) => (typeof v === 'string' ? v : new Date(v).toISOString())
const text = computed(() => {
  if (props.end !== undefined) return dateRange(props.value, props.end)
  return props.withTime ? dateTime(props.value) : date(props.value, props.dateStyle)
})
</script>

<template>
  <time :datetime="props.end !== undefined ? `${iso(props.value)}/${iso(props.end)}` : iso(props.value)">{{ text }}</time>
</template>
