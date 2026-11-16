<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Eyebrow, title (h2 or h3, never h1 here) and subtitle of a section, start or centre aligned. */
const props = withDefaults(defineProps<{ section: RenderedSection, size?: 'md' | 'lg' }>(), { size: 'md' })
const { text, level } = useSectionContext(() => props.section)
const c = computed(() => props.section.content)
const center = computed(() => props.section.settings.heading_align === 'center')
</script>

<template>
  <header v-if="c.eyebrow || c.title || c.subtitle" class="mb-12 max-w-editorial lg:mb-16" :class="center && 'mx-auto text-center'">
    <p v-if="c.eyebrow" class="eyebrow mb-4">{{ text(c.eyebrow) }}</p>
    <component :is="`h${level}`" v-if="c.title" :id="`${props.section.id}-title`" class="text-balance" :class="props.size === 'lg' ? 'text-display-lg' : level === 2 ? 'text-h1' : 'text-h2'">
      {{ text(c.title) }}
    </component>
    <p v-if="c.subtitle" class="mt-6 text-body-lg text-muted">{{ text(c.subtitle) }}</p>
  </header>
</template>
