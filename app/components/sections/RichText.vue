<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Formatted text (sanitised by the API: paragraphs, emphasis, lists, quotes, links). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const sizes = { narrow: 'editorial', normal: 'narrow', wide: 'page' } as const
</script>

<template>
  <MzSectionContainer :section="props.section" :size="sizes[props.section.settings.max_width as keyof typeof sizes] ?? 'narrow'">
    <MzSectionHeading :section="props.section" />
    <!-- eslint-disable-next-line vue/no-v-html -- sanitised server side (ammonia allowlist) -->
    <div class="mz-prose" v-html="props.section.content.body" />
  </MzSectionContainer>
</template>
