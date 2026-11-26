<script setup lang="ts">
import { WEEKDAY_BITS, hasDay, toggleDay } from '~/utils/catalog'

/** Weekday toggle chips bound to the Mon=1 … Sun=64 bitmask (never empty). */
const props = withDefaults(defineProps<{ label?: string, size?: 'xs' | 'sm' }>(), { label: undefined, size: 'xs' })
const model = defineModel<number>({ default: 127 })
const { t } = useI18n()
const names = computed(() => [0, 1, 2, 3, 4, 5, 6].map(i => t(`admin.catalog.weekdays.${i}`)))
</script>

<template>
  <div class="flex flex-wrap gap-1" role="group" :aria-label="props.label ?? t('admin.catalog.daysOfWeek')">
    <UButton
      v-for="(bit, i) in WEEKDAY_BITS"
      :key="bit"
      :label="names[i]"
      :size="props.size"
      :color="hasDay(model, i) ? 'primary' : 'neutral'"
      :variant="hasDay(model, i) ? 'soft' : 'outline'"
      :aria-pressed="hasDay(model, i)"
      :data-testid="`weekday-${i}`"
      @click="model = toggleDay(model, i)"
    />
  </div>
</template>
