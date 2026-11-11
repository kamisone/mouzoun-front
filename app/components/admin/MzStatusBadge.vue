<script setup lang="ts">
/**
 * Status of a booking, payment or content item: one colour and one translated label per
 * status, everywhere. Unknown statuses fall back to a neutral badge with the raw code.
 */
type Color = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const props = withDefaults(defineProps<{ status: string, size?: 'sm' | 'md' }>(), { size: 'md' })
const { t, te } = useI18n()

const COLORS: Record<string, Color> = {
  draft: 'neutral',
  pending: 'warning',
  awaiting_payment: 'warning',
  confirmed: 'success',
  checked_in: 'info',
  completed: 'secondary',
  cancelled: 'error',
  no_show: 'error',
  expired: 'neutral',
  published: 'success',
  archived: 'neutral',
  succeeded: 'success',
  failed: 'error',
  refunded: 'info',
}
const label = computed(() => (te(`status.${props.status}`) ? t(`status.${props.status}`) : props.status))
</script>

<template>
  <UBadge :label="label" :color="COLORS[props.status] ?? 'neutral'" variant="subtle" :size="props.size" />
</template>
