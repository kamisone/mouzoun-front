<script setup lang="ts">
/** Page frame: 1280 px max, 24 px gutters on mobile, 48 px on desktop. `editorial` = 680 px text column. */
const props = withDefaults(defineProps<{
  as?: string
  size?: 'page' | 'narrow' | 'editorial'
}>(), { as: 'div', size: 'page' })
const widths = { page: 'max-w-page', narrow: 'max-w-narrow', editorial: 'max-w-editorial' }
</script>

<template>
  <component :is="props.as" class="mx-auto w-full px-6 lg:px-12" :class="widths[props.size]">
    <slot />
  </component>
</template>
