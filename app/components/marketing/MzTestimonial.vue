<script setup lang="ts">
/** A guest review: quote, author, origin, optional 1–5 rating (announced as text). */
const props = withDefaults(defineProps<{
  quote: string
  author: string
  origin?: string
  rating?: number
  avatar?: string
}>(), { origin: undefined, rating: undefined, avatar: undefined })
const { t } = useI18n()
</script>

<template>
  <figure class="flex h-full flex-col gap-4 rounded-lg bg-elevated p-6 shadow-soft">
    <p v-if="props.rating" class="flex gap-0.5 text-warning" role="img" :aria-label="t('a11y.rating', { value: props.rating })">
      <UIcon v-for="n in 5" :key="n" :name="n <= props.rating ? 'i-lucide-star' : 'i-lucide-star-off'" class="size-4" aria-hidden="true" />
    </p>
    <blockquote class="flex-1 font-display text-lg text-highlighted text-pretty">“{{ props.quote }}”</blockquote>
    <figcaption class="flex items-center gap-3">
      <UAvatar :src="props.avatar" :alt="props.author" size="md" />
      <span class="flex flex-col">
        <span class="font-semibold text-highlighted">{{ props.author }}</span>
        <span v-if="props.origin" class="text-sm text-muted">{{ props.origin }}</span>
      </span>
    </figcaption>
  </figure>
</template>
