<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** A photo beside a title, formatted text (sanitised by the API) and up to two buttons. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { media } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const image = computed(() => media(s.value.media_id))
const ratios = { 'square': '1/1', '4:3': '4/3', '16:9': '16/9', 'portrait': '4/5' } as const
</script>

<template>
  <MzSectionContainer :section="props.section">
    <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
      <MzReveal v-if="image" class="lg:col-span-6" :class="s.media_side === 'end' && 'lg:order-2 lg:col-start-7'">
        <MzMedia :media="image" :alt="props.section.content.media_alt" :ratio="ratios[s.media_ratio as keyof typeof ratios] ?? '4/3'" sizes="(min-width: 1024px) 50vw, 100vw" />
      </MzReveal>
      <MzReveal :index="1" :class="image ? (s.media_side === 'end' ? 'lg:order-1 lg:col-span-5' : 'lg:col-span-5 lg:col-start-8') : 'lg:col-span-8'">
        <MzSectionHeading :section="props.section" />
        <!-- eslint-disable-next-line vue/no-v-html -- sanitised server side (ammonia allowlist) -->
        <div v-if="props.section.content.body" class="mz-prose -mt-4 text-muted" v-html="props.section.content.body" />
        <MzSectionCtas :section="props.section" class="mt-12" />
      </MzReveal>
    </div>
  </MzSectionContainer>
</template>
