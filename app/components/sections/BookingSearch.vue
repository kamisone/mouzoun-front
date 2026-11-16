<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Dates and guests, leading to the stays search (inline bar or a card). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const card = computed(() => props.section.settings.layout === 'card')
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <div :class="card ? 'max-w-xl rounded-sm bg-elevated p-6' : 'max-w-4xl'">
      <MzSearchBar :variant="card ? 'stacked' : 'bar'" />
    </div>
  </MzSectionContainer>
</template>
