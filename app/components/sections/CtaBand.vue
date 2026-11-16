<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** A calm closing band: title, one line of text and up to two buttons (background photo optional). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { text, media, level } = useSectionContext(() => props.section)
const c = computed(() => props.section.content)
const background = computed(() => media(props.section.settings.background_media_id))
</script>

<template>
  <div class="relative isolate" :class="background && 'dark py-16 text-default'">
    <template v-if="background">
      <MzMedia :media="background" fill decorative :rounded="false" class="-z-10" />
      <div class="absolute inset-0 -z-10 bg-default/70" aria-hidden="true" />
    </template>
    <MzContainer size="editorial" class="text-center">
      <MzReveal>
        <p v-if="c.eyebrow" class="eyebrow mb-4">{{ text(c.eyebrow) }}</p>
        <component :is="`h${level}`" :id="`${props.section.id}-title`" class="text-display-lg text-balance">{{ text(c.title) }}</component>
        <p v-if="c.subtitle || c.text" class="mt-6 text-body-lg text-muted">{{ text(c.text || c.subtitle) }}</p>
        <MzSectionCtas :section="props.section" center class="light mt-12" />
      </MzReveal>
    </MzContainer>
  </div>
</template>
