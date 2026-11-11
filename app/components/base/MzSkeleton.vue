<script setup lang="ts">
/** Loading placeholders shaped like the content they stand for (no layout shift). */
const props = withDefaults(defineProps<{
  variant?: 'text' | 'card' | 'avatar' | 'image'
  /** Lines of text (variant text). */
  lines?: number
}>(), { variant: 'text', lines: 3 })
const { t } = useI18n()
</script>

<template>
  <div role="status" :aria-label="t('common.loading')" aria-live="polite" class="w-full">
    <div v-if="props.variant === 'text'" class="space-y-2">
      <USkeleton v-for="n in props.lines" :key="n" class="h-4" :class="n === props.lines && props.lines > 1 ? 'w-2/3' : 'w-full'" />
    </div>
    <USkeleton v-else-if="props.variant === 'avatar'" class="size-10 rounded-full" />
    <USkeleton v-else-if="props.variant === 'image'" class="aspect-[4/3] w-full rounded-lg" />
    <div v-else class="overflow-hidden rounded-lg border border-default">
      <USkeleton class="aspect-[4/3] w-full rounded-none" />
      <div class="space-y-2 p-5">
        <USkeleton class="h-5 w-3/4" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-1/2" />
      </div>
    </div>
  </div>
</template>
