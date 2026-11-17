<script setup lang="ts">
import type { Issue } from '~/utils/shop-types'

/** One pricing issue of the cart, in words ("Only 2 available", "Cannot be shipped to FR"). */
const props = defineProps<{ issue: Issue, currency?: string }>()
const { t } = useI18n()
const { money } = useMoney()

const text = computed(() => {
  const d = props.issue.data ?? {}
  switch (props.issue.code) {
    case 'quantity_limited':
      return t('shop.issues.quantity_limited', { max: d.max as number })
    case 'below_min_order':
      return t('shop.issues.below_min_order', { min: money(Number(d.min_minor ?? 0), props.currency) })
    case 'promotion_not_applicable': {
      const reason = String(d.reason ?? 'unknown')
      const key = `shop.issues.reasons.${reason}`
      return t('shop.issues.promotion_not_applicable', { code: String(d.code ?? ''), reason: t(key) === key ? reason : t(key) })
    }
    default:
      return t(`shop.issues.${props.issue.code}`)
  }
})
const blocking = computed(() => props.issue.code !== 'promotion_not_applicable')
</script>

<template>
  <p class="flex items-start gap-2 text-small" :class="blocking ? 'text-error' : 'text-warning'" data-testid="shop-issue">
    <UIcon :name="blocking ? 'i-lucide-circle-alert' : 'i-lucide-info'" class="mt-1 size-4 shrink-0" aria-hidden="true" />
    <span>{{ text }}</span>
  </p>
</template>
