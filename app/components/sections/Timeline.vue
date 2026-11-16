<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Steps of a day or of a story, vertical (a line on the start side) or horizontal (scrolls on mobile). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { text, media } = useSectionContext(() => props.section)
const horizontal = computed(() => props.section.settings.orientation === 'horizontal')
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <ol :class="horizontal ? 'flex snap-x gap-8 overflow-x-auto pb-4' : 'relative max-w-editorial border-s border-default ps-8'">
      <MzReveal v-for="(step, i) in props.section.items" :key="step.id" as="li" :index="i" :class="horizontal ? 'w-72 shrink-0 snap-start border-t border-default pt-6' : 'relative pb-12 last:pb-0'">
        <span v-if="!horizontal" class="absolute -start-8 top-2 size-3 -translate-x-1/2 rounded-full bg-primary rtl:translate-x-1/2" aria-hidden="true" />
        <p v-if="step.settings.time_label" class="eyebrow mb-2">{{ step.settings.time_label }}</p>
        <h3 class="text-h3">{{ text(step.content.title) }}</h3>
        <p v-if="step.content.text" class="mt-2 text-muted">{{ text(step.content.text) }}</p>
        <MzMedia v-if="media(step.settings.media_id)" :media="media(step.settings.media_id)!" ratio="3/2" class="mt-6" sizes="(min-width: 1024px) 33vw, 100vw" />
      </MzReveal>
    </ol>
  </MzSectionContainer>
</template>
