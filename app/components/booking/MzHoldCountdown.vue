<script setup lang="ts">
/**
 * "We are holding your tent for 14:32" — calm, only on the payment step. Announced to screen
 * readers once a minute, not every second.
 */
const props = defineProps<{ until: string }>()
const emit = defineEmits<{ expired: [] }>()
const { t } = useI18n()
const now = ref(Date.now())
useIntervalFn(() => { now.value = Date.now() }, 1000)
const left = computed(() => Math.max(0, Math.floor((new Date(props.until).getTime() - now.value) / 1000)))
const label = computed(() => `${Math.floor(left.value / 60)}:${String(left.value % 60).padStart(2, '0')}`)
const minutes = computed(() => Math.ceil(left.value / 60))
watch(left, (v, old) => {
  if (v === 0 && old > 0) emit('expired')
})
</script>

<template>
  <p class="flex items-center gap-2 text-small text-muted" data-testid="hold-countdown">
    <UIcon name="i-lucide-hourglass" class="size-4" aria-hidden="true" />
    <span aria-hidden="true">{{ t('booking.pay.holding', { time: label }) }}</span>
    <span class="sr-only" aria-live="polite">{{ t('booking.pay.holdingMinutes', { n: minutes }, minutes) }}</span>
  </p>
</template>
