<script setup lang="ts">
/** Placeholder for empty lists and missing content. Actions go in the default slot. */
const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
}>(), { icon: 'i-lucide-inbox', title: undefined, description: undefined })
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-accented px-6 py-12 text-center">
    <UIcon :name="props.icon" class="size-6 text-dimmed" aria-hidden="true" />
    <p class="font-display text-h3 text-highlighted">{{ props.title ?? t('empty.title') }}</p>
    <p v-if="props.description !== ''" class="max-w-md text-small text-muted">{{ props.description ?? t('empty.description') }}</p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
