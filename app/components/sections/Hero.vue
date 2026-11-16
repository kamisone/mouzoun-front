<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'
import { srcsetOf } from '~/utils/page-builder'

/**
 * The page's main title (the only <h1>): full-width photo or muted looping video, a scrim whose
 * darkness the editor sets, text placed by `content_position`, up to two buttons and the booking
 * search. The photo is preloaded with high priority (LCP); its space is reserved (no shift).
 */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { text, media } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const c = computed(() => props.section.content)
const reducedMotion = usePreferredReducedMotion()

const image = computed(() => media(s.value.media_type === 'video' ? s.value.poster_media_id : s.value.media_id) ?? media(s.value.media_id))
const mobile = computed(() => media(s.value.mobile_media_id))
const video = computed(() => (s.value.media_type === 'video' ? media(s.value.media_id) : undefined))
const playVideo = computed(() => !!video.value && reducedMotion.value !== 'reduce')
const heights = { screen: 'min-h-svh', large: 'min-h-[80svh]', medium: 'min-h-[60svh]' } as const
const positions = {
  center: 'items-center justify-center text-center',
  center_start: 'items-center',
  bottom_start: 'items-end',
  bottom_center: 'items-end justify-center text-center',
} as const
const centered = computed(() => ['center', 'bottom_center'].includes(s.value.content_position))
const sizes = '100vw' // lint-tokens-ignore (native sizes)

if (image.value) {
  useHead({
    link: [
      ...(mobile.value ? [{ rel: 'preload' as const, as: 'image' as const, href: mobile.value.url, imagesrcset: srcsetOf(mobile.value), imagesizes: sizes, media: '(max-width: 767px)', fetchpriority: 'high' as const }] : []),
      { rel: 'preload' as const, as: 'image' as const, href: image.value.url, imagesrcset: srcsetOf(image.value), imagesizes: sizes, media: mobile.value ? '(min-width: 768px)' : undefined, fetchpriority: 'high' as const },
    ],
  })
}
</script>

<template>
  <div class="dark relative isolate flex overflow-hidden bg-default text-default" :class="[heights[s.height as keyof typeof heights] ?? heights.large, positions[s.content_position as keyof typeof positions] ?? positions.bottom_start]">
    <div class="absolute inset-0 -z-10">
      <video v-if="playVideo && video" class="size-full object-cover" :src="video.url" :poster="image?.url" autoplay muted loop playsinline aria-hidden="true" />
      <picture v-else-if="image">
        <source v-if="mobile" media="(max-width: 767px)" :srcset="srcsetOf(mobile) ?? mobile.url" :sizes="sizes">
        <img
          :src="image.url"
          :srcset="srcsetOf(image)"
          :sizes="sizes"
          :width="image.width ?? undefined"
          :height="image.height ?? undefined"
          :alt="image.alt ?? ''"
          loading="eager"
          fetchpriority="high"
          decoding="async"
          class="size-full object-cover"
          :style="{ objectPosition: image.position ?? undefined, backgroundImage: image.placeholder ? `url(${image.placeholder})` : undefined, backgroundSize: 'cover' }"
        >
      </picture>
      <div class="absolute inset-0 bg-default" :style="{ opacity: (Number(s.overlay_opacity ?? 35)) / 100 }" aria-hidden="true" />
      <div class="absolute inset-0 bg-linear-to-t from-default/70 via-transparent to-default/20" aria-hidden="true" />
    </div>

    <MzContainer class="pt-40 pb-16 lg:pb-24">
      <div class="max-w-4xl" :class="centered && 'mx-auto'">
        <p v-if="c.eyebrow" class="eyebrow mb-6 text-highlighted">{{ text(c.eyebrow) }}</p>
        <h1 :id="`${props.section.id}-title`" class="text-display-xl text-balance">{{ text(c.title) }}</h1>
        <p v-if="c.subtitle" class="mt-6 max-w-editorial text-body-lg text-highlighted" :class="centered && 'mx-auto'">{{ text(c.subtitle) }}</p>
        <p v-if="c.text" class="mt-6 max-w-editorial text-body-lg text-highlighted" :class="centered && 'mx-auto'">{{ text(c.text) }}</p>
        <div class="light mt-12 flex flex-col gap-8">
          <MzSectionCtas :section="props.section" :center="centered" />
          <div v-if="s.show_booking_search" class="max-w-3xl rounded-sm bg-default p-2" :class="centered && 'mx-auto'">
            <MzSearchBar />
          </div>
        </div>
      </div>
    </MzContainer>
  </div>
</template>
