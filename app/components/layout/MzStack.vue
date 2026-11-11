<script setup lang="ts">
/** Flex stack with a spacing scale; `direction="row"` wraps on small screens. */
const props = withDefaults(defineProps<{
  direction?: 'column' | 'row'
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between'
  wrap?: boolean
  as?: string
}>(), { direction: 'column', gap: 'md', align: 'stretch', justify: 'start', wrap: false, as: 'div' })

const gaps = { xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6', xl: 'gap-10' }
const aligns = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch', baseline: 'items-baseline' }
const justifies = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between' }
</script>

<template>
  <component
    :is="props.as"
    class="flex"
    :class="[props.direction === 'row' ? 'flex-row' : 'flex-col', gaps[props.gap], aligns[props.align], justifies[props.justify], (props.wrap || props.direction === 'row') && 'flex-wrap']"
  >
    <slot />
  </component>
</template>
