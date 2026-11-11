<script setup lang="ts">
/** A guest review: serif quote, name and origin. Optional 1–5 rating announced as text. */
const props = withDefaults(defineProps<{
  quote: string
  author: string
  origin?: string
  rating?: number
}>(), { origin: undefined, rating: undefined })
const { t } = useI18n()
</script>

<template>
  <figure class="flex h-full flex-col gap-6 border-t border-default pt-6">
    <blockquote class="flex-1 font-display text-h3 text-highlighted italic">“{{ props.quote }}”</blockquote>
    <figcaption class="flex flex-col gap-1">
      <span class="text-small font-medium text-highlighted">{{ props.author }}</span>
      <span class="text-caption text-muted">
        <template v-if="props.origin">{{ props.origin }}</template>
        <template v-if="props.rating"> · <span :aria-label="t('a11y.rating', { value: props.rating })">{{ props.rating }}/5</span></template>
      </span>
    </figcaption>
  </figure>
</template>
