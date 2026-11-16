<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Vertical space, optionally with a line or a dune divider. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const sizes = { sm: 'h-8', md: 'h-16', lg: 'h-24', xl: 'h-40' } as const
</script>

<template>
  <MzContainer aria-hidden="true">
    <div class="flex items-center" :class="sizes[props.section.settings.size as keyof typeof sizes] ?? sizes.md">
      <hr v-if="props.section.settings.divider === 'line'" class="w-full border-default">
      <svg v-else-if="props.section.settings.divider === 'dunes'" class="h-6 w-full text-(--ui-border-accented)" viewBox="0 0 1440 40" preserveAspectRatio="none">
        <path d="M0 30 C 180 10 360 4 560 22 C 700 34 820 6 1000 12 C 1180 18 1300 30 1440 20" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />
      </svg>
    </div>
  </MzContainer>
</template>
