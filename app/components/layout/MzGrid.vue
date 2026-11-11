<script setup lang="ts">
/** Responsive grid on the 12-column rhythm: 1 column on phones, up to `cols` from `lg`. */
const props = withDefaults(defineProps<{
  cols?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  as?: string
}>(), { cols: 3, gap: 'md', as: 'div' })

const columns = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}
const gaps = { sm: 'gap-4', md: 'gap-x-6 gap-y-12 lg:gap-x-8', lg: 'gap-x-8 gap-y-16 lg:gap-x-12' }
</script>

<template>
  <component :is="props.as" class="grid" :class="[columns[props.cols], gaps[props.gap]]">
    <slot />
  </component>
</template>
