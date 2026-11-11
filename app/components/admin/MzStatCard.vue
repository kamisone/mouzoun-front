<script setup lang="ts">
/** Key figure for dashboards: label, value, optional change versus the previous period. */
const props = withDefaults(defineProps<{
  label: string
  value: string | number | null
  icon?: string
  /** Change as a ratio (0.12 = +12 %). */
  delta?: number | null
  loading?: boolean
}>(), { icon: undefined, delta: null, loading: false })

const { percent } = useNumber()
const trend = computed(() => (props.delta == null ? null : props.delta > 0 ? 'up' : props.delta < 0 ? 'down' : 'flat'))
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-5' }">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-medium text-muted">{{ props.label }}</p>
      <UIcon v-if="props.icon" :name="props.icon" class="size-5 text-primary" aria-hidden="true" />
    </div>
    <USkeleton v-if="props.loading" class="mt-2 h-8 w-24" />
    <p v-else class="mt-1 font-display text-3xl font-semibold text-highlighted tabular-nums">{{ props.value ?? '—' }}</p>
    <p
      v-if="trend && !props.loading"
      class="mt-1 inline-flex items-center gap-1 text-sm font-semibold"
      :class="trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-muted'"
    >
      <UIcon :name="trend === 'up' ? 'i-lucide-trending-up' : trend === 'down' ? 'i-lucide-trending-down' : 'i-lucide-minus'" class="size-4" aria-hidden="true" />
      {{ percent(props.delta!) }}
    </p>
  </UCard>
</template>
