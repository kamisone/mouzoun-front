<script setup lang="ts">
/** Horizontal page frame: max width + responsive gutters (16 px on phones). */
const props = withDefaults(defineProps<{
  as?: string
  size?: 'page' | 'narrow' | 'prose'
}>(), { as: 'div', size: 'page' })
const widths = { page: 'max-w-page', narrow: 'max-w-narrow', prose: 'max-w-prose-wide' }
</script>

<template>
  <component :is="props.as" class="mx-auto w-full px-4 sm:px-6 lg:px-8" :class="widths[props.size]">
    <slot />
  </component>
</template>
