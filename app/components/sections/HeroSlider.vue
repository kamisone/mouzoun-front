<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'
import { srcsetOf } from '~/utils/page-builder'

/**
 * Hero with several slides (fade or slide). The first slide's title is the page's <h1>, the
 * others are <h2>. Arrows and arrow keys follow the reading direction, swipe on touch screens,
 * autoplay pauses on hover/focus, has a pause button and never runs under reduced motion.
 */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { text, media } = useSectionContext(() => props.section)
const { t } = useI18n()
const s = computed(() => props.section.settings)
const slides = computed(() => props.section.items)
const current = ref(0)
const paused = ref(false)
const hovered = ref(false)
const focused = ref(false)
const reducedMotion = usePreferredReducedMotion()
const dir = useTextDirection({ selector: 'html' })
const heights = { screen: 'min-h-svh', large: 'min-h-[80svh]', medium: 'min-h-[60svh]' } as const
const sizes = '100vw' // lint-tokens-ignore (native sizes)

function go(delta: number) {
  const n = slides.value.length
  current.value = (current.value + delta + n) % n
}
function onKey(e: KeyboardEvent) {
  if (e.key === (dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) go(1)
  if (e.key === (dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) go(-1)
}
let startX = 0
function onPointerDown(e: PointerEvent) {
  startX = e.clientX
}
function onPointerUp(e: PointerEvent) {
  const dx = e.clientX - startX
  if (Math.abs(dx) < 40) return
  go((dx < 0 ? 1 : -1) * (dir.value === 'rtl' ? -1 : 1))
}

const playing = computed(() => !!s.value.autoplay && reducedMotion.value !== 'reduce' && !paused.value && !hovered.value && !focused.value && slides.value.length > 1)
const { pause, resume } = useIntervalFn(() => go(1), () => Number(s.value.interval_seconds ?? 6) * 1000, { immediate: false })
watch(playing, on => (on ? resume() : pause()), { immediate: true })

const first = computed(() => media(slides.value[0]?.settings.media_id))
if (first.value) {
  useHead({ link: [{ rel: 'preload', as: 'image', href: first.value.url, imagesrcset: srcsetOf(first.value), imagesizes: sizes, fetchpriority: 'high' }] })
}
</script>

<template>
  <div
    class="dark relative isolate overflow-hidden bg-default text-default"
    :class="heights[s.height as keyof typeof heights] ?? heights.large"
    role="region"
    aria-roledescription="carousel"
    :aria-label="text(slides[0]?.content.title)"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="focused = false"
    @keydown="onKey"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <div
      v-for="(slide, i) in slides"
      :key="slide.id"
      role="group"
      aria-roledescription="slide"
      :aria-label="t('sections.carousel.slideOf', { n: i + 1, total: slides.length })"
      :aria-hidden="i !== current"
      :inert="i !== current"
      class="absolute inset-0 flex items-end transition duration-700 ease-(--ease-editorial) motion-reduce:transition-none"
      :class="[
        i === current ? 'z-10 opacity-100' : 'z-0 opacity-0',
        s.transition === 'slide' && (i === current ? 'translate-x-0' : i < current ? '-translate-x-full rtl:translate-x-full' : 'translate-x-full rtl:-translate-x-full'),
      ]"
    >
      <div class="absolute inset-0 -z-10">
        <picture v-if="media(slide.settings.media_id)">
          <source v-if="media(slide.settings.mobile_media_id)" media="(max-width: 767px)" :srcset="srcsetOf(media(slide.settings.mobile_media_id)) ?? media(slide.settings.mobile_media_id)!.url" :sizes="sizes">
          <img
            :src="media(slide.settings.media_id)!.url"
            :srcset="srcsetOf(media(slide.settings.media_id))"
            :sizes="sizes"
            :alt="media(slide.settings.media_id)!.alt ?? ''"
            :loading="i === 0 ? 'eager' : 'lazy'"
            :fetchpriority="i === 0 ? 'high' : 'auto'"
            decoding="async"
            class="size-full object-cover"
            :style="{ objectPosition: media(slide.settings.media_id)!.position ?? undefined }"
          >
        </picture>
        <div class="absolute inset-0 bg-default" :style="{ opacity: Number(slide.settings.overlay_opacity ?? 35) / 100 }" aria-hidden="true" />
      </div>
      <MzContainer class="pt-40 pb-24">
        <div class="max-w-4xl">
          <component :is="i === 0 ? 'h1' : 'h2'" class="text-display-xl text-balance">{{ text(slide.content.title) }}</component>
          <p v-if="slide.content.text" class="mt-6 max-w-editorial text-body-lg text-highlighted">{{ text(slide.content.text) }}</p>
          <div v-if="slide.settings.cta?.link?.href && slide.content.cta_label" class="light mt-12">
            <UButton :label="text(slide.content.cta_label)" :to="slide.settings.cta.link.href" :external="slide.settings.cta.link.href.startsWith('#')" size="lg" :color="slide.settings.cta.style === 'primary' || !slide.settings.cta.style ? 'primary' : 'neutral'" :variant="slide.settings.cta.style === 'ghost' ? 'ghost' : slide.settings.cta.style === 'secondary' ? 'outline' : 'solid'" />
          </div>
        </div>
      </MzContainer>
    </div>

    <div v-if="slides.length > 1" class="absolute inset-x-0 bottom-6 z-20">
      <MzContainer class="flex items-center justify-between gap-4">
        <div v-if="s.show_dots" class="flex gap-2">
          <button
            v-for="(slide, i) in slides"
            :key="slide.id"
            type="button"
            class="size-3 rounded-full border border-inverted"
            :class="i === current ? 'bg-inverted' : 'bg-transparent'"
            :aria-label="t('sections.carousel.goTo', { n: i + 1 })"
            :aria-current="i === current"
            @click="current = i"
          />
        </div>
        <div class="flex gap-2">
          <UButton v-if="s.autoplay && reducedMotion !== 'reduce'" :icon="paused ? 'i-lucide-play' : 'i-lucide-pause'" color="neutral" variant="ghost" :aria-label="paused ? t('sections.carousel.play') : t('sections.carousel.pause')" @click="paused = !paused" />
          <template v-if="s.show_arrows">
            <UButton icon="i-lucide-arrow-left" class="rtl:rotate-180" color="neutral" variant="outline" :aria-label="t('sections.carousel.previous')" @click="go(-1)" />
            <UButton icon="i-lucide-arrow-right" class="rtl:rotate-180" color="neutral" variant="outline" :aria-label="t('sections.carousel.next')" @click="go(1)" />
          </template>
        </div>
      </MzContainer>
    </div>
    <div v-if="s.show_booking_search" class="light absolute inset-x-0 bottom-24 z-20">
      <MzContainer><div class="max-w-3xl rounded-sm bg-default p-2"><MzSearchBar /></div></MzContainer>
    </div>
  </div>
</template>
