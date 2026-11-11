<script setup lang="ts">
/** Responsive grid: 1 column on phones, up to `cols` from the `lg` breakpoint. */
const props = withDefaults(defineProps<{
  cols?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  as?: string
}>(), { cols: 3, gap: 'md', as: 'div' })

// Literal class names so Tailwind generates them.
const columns = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}
const gaps = { sm: 'gap-3', md: 'gap-6', lg: 'gap-8' }
</script>

<template>
  <component :is="props.as" class="grid" :class="[columns[props.cols], gaps[props.gap]]">
    <slot />
  </component>
</template>
