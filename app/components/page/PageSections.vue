<script setup lang="ts">
import type { Component } from 'vue'
import type { RenderedSection } from '~/utils/page-types'
import { PAGE_CONTEXT } from '~/composables/useSectionContext'

/**
 * Renders the sections of a page: each `type` maps to a lazily loaded component of
 * components/sections/ (server-rendered all the same). An unknown type renders nothing (and
 * warns in development), so a newer API never breaks an older front.
 */
const props = withDefaults(defineProps<{
  sections: RenderedSection[]
  variables?: Record<string, string | null>
  preview?: boolean
}>(), { variables: () => ({}), preview: false })

const registry: Record<string, Component> = {
  hero: defineAsyncComponent(() => import('~/components/sections/Hero.vue')),
  hero_slider: defineAsyncComponent(() => import('~/components/sections/HeroSlider.vue')),
  booking_search: defineAsyncComponent(() => import('~/components/sections/BookingSearch.vue')),
  product_carousel: defineAsyncComponent(() => import('~/components/sections/ProductCarousel.vue')),
  category_tiles: defineAsyncComponent(() => import('~/components/sections/CategoryTiles.vue')),
  image_text: defineAsyncComponent(() => import('~/components/sections/ImageText.vue')),
  features: defineAsyncComponent(() => import('~/components/sections/Features.vue')),
  stats: defineAsyncComponent(() => import('~/components/sections/Stats.vue')),
  timeline: defineAsyncComponent(() => import('~/components/sections/Timeline.vue')),
  seasonal_calendar: defineAsyncComponent(() => import('~/components/sections/SeasonalCalendar.vue')),
  gallery: defineAsyncComponent(() => import('~/components/sections/Gallery.vue')),
  video: defineAsyncComponent(() => import('~/components/sections/Video.vue')),
  offers: defineAsyncComponent(() => import('~/components/sections/Offers.vue')),
  testimonials: defineAsyncComponent(() => import('~/components/sections/Testimonials.vue')),
  logos: defineAsyncComponent(() => import('~/components/sections/Logos.vue')),
  map: defineAsyncComponent(() => import('~/components/sections/Map.vue')),
  faq: defineAsyncComponent(() => import('~/components/sections/Faq.vue')),
  cta_band: defineAsyncComponent(() => import('~/components/sections/CtaBand.vue')),
  newsletter: defineAsyncComponent(() => import('~/components/sections/Newsletter.vue')),
  contact: defineAsyncComponent(() => import('~/components/sections/Contact.vue')),
  posts_feed: defineAsyncComponent(() => import('~/components/sections/PostsFeed.vue')),
  rich_text: defineAsyncComponent(() => import('~/components/sections/RichText.vue')),
  html: defineAsyncComponent(() => import('~/components/sections/Html.vue')),
  spacer: defineAsyncComponent(() => import('~/components/sections/Spacer.vue')),
}

provide(PAGE_CONTEXT, reactive({
  variables: computed(() => props.variables),
  preview: computed(() => props.preview),
}) as unknown as { variables: Record<string, string | null>, preview: boolean })

const known = computed(() =>
  props.sections.filter((s) => {
    if (registry[s.type]) return true
    if (import.meta.dev) console.warn(`[PageSections] unknown section type "${s.type}" (${s.id}): not rendered`)
    return false
  }),
)
</script>

<template>
  <div>
    <MzSectionFrame v-for="(section, i) in known" :key="section.id" :section="section">
      <component :is="registry[section.type]" :section="section" :index="i" />
    </MzSectionFrame>
  </div>
</template>
