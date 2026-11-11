<script setup lang="ts">
/** Placeholder for empty lists and missing content. Actions go in the default slot. */
const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
}>(), { icon: 'i-lucide-tent', title: undefined, description: undefined })
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-accented bg-muted/40 px-6 py-12 text-center">
    <span class="flex size-12 items-center justify-center rounded-full bg-elevated text-primary shadow-soft">
      <UIcon :name="props.icon" class="size-6" aria-hidden="true" />
    </span>
    <p class="font-display text-lg font-semibold text-highlighted">{{ props.title ?? t('empty.title') }}</p>
    <p class="max-w-md text-sm text-muted">{{ props.description ?? t('empty.description') }}</p>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
