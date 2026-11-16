<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** The section's content width: the page container, or edge to edge (`appearance.width = full`). */
const props = withDefaults(defineProps<{ section: RenderedSection, size?: 'page' | 'narrow' | 'editorial' }>(), { size: 'page' })
const full = computed(() => props.section.appearance.width === 'full')
</script>

<template>
  <div v-if="full" class="w-full">
    <slot />
  </div>
  <MzContainer v-else :size="props.size">
    <slot />
  </MzContainer>
</template>
