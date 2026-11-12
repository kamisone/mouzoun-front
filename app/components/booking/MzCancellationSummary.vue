<script setup lang="ts">
import type { CancellationStep } from '~/utils/booking-types'

/**
 * The cancellation policy in plain words with exact dates and times (camp time):
 * "Free cancellation until 15 Dec 2026, 14:00", "50 % refunded until…", "No refund after…".
 * `compact` shows only the first, most useful line.
 */
const props = withDefaults(defineProps<{ steps: CancellationStep[], compact?: boolean }>(), { compact: false })
const { t } = useI18n()
const { dateTime } = useDate()

const lines = computed(() => {
  const out: { icon: string, text: string, tone: 'good' | 'mid' | 'none' }[] = []
  let previous: string | null = null
  for (const step of props.steps) {
    if (step.refund_percent >= 100 && step.until) {
      out.push({ icon: 'i-lucide-circle-check', text: t('booking.cancellation.free', { date: dateTime(step.until) }), tone: 'good' })
    }
    else if (step.refund_percent > 0 && step.until) {
      out.push({ icon: 'i-lucide-circle-dot', text: t('booking.cancellation.partial', { percent: step.refund_percent, date: dateTime(step.until) }), tone: 'mid' })
    }
    else if (step.refund_percent === 0 && previous) {
      out.push({ icon: 'i-lucide-circle-slash', text: t('booking.cancellation.none', { date: dateTime(previous) }), tone: 'none' })
    }
    else if (step.refund_percent === 0) {
      out.push({ icon: 'i-lucide-circle-slash', text: t('booking.cancellation.nonRefundable'), tone: 'none' })
    }
    previous = step.until
  }
  return out
})
</script>

<template>
  <ul v-if="lines.length" class="flex flex-col gap-2 text-small" data-testid="cancellation-summary">
    <li v-for="(line, i) in props.compact ? lines.slice(0, 1) : lines" :key="i" class="flex items-start gap-2">
      <UIcon :name="line.icon" class="mt-1 size-4 shrink-0" :class="line.tone === 'good' ? 'text-success' : 'text-muted'" aria-hidden="true" />
      <span :class="line.tone === 'good' ? 'font-medium text-highlighted' : 'text-default'">{{ line.text }}</span>
    </li>
  </ul>
  <p v-else class="text-small text-muted">{{ t('booking.cancellation.askCamp') }}</p>
</template>
