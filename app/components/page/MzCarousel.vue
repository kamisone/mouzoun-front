<script setup lang="ts">
/**
 * Accessible carousel: native scroll-snap (swipe and trackpad), previous/next buttons that follow
 * the reading direction (mirrored in Arabic), arrow keys, "n of N" announced per slide, optional
 * autoplay that pauses on hover and focus, has a pause button, and never runs under
 * prefers-reduced-motion.
 */
const props = withDefaults(defineProps<{
  count: number
  label: string
  /** Slide width classes (e.g. "basis-full md:basis-1/2 lg:basis-1/3"). */
  slideClass?: string
  autoplay?: boolean
  intervalSeconds?: number
  showArrows?: boolean
}>(), { slideClass: 'basis-4/5 sm:basis-1/2 lg:basis-1/3', autoplay: false, intervalSeconds: 6, showArrows: true })

const { t } = useI18n()
const track = useTemplateRef<HTMLElement>('track')
const dir = useTextDirection({ selector: 'html' })
const reducedMotion = usePreferredReducedMotion()
const hovered = ref(false)
const focused = ref(false)
const paused = ref(false)
const current = ref(0)
const uid = useId()

function slideWidth() {
  const first = track.value?.querySelector<HTMLElement>('[data-slide]')
  return first ? first.offsetWidth + 24 : track.value?.clientWidth ?? 0
}

function go(delta: number) {
  const el = track.value
  if (!el) return
  const sign = dir.value === 'rtl' ? -1 : 1
  const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4
  if (delta > 0 && atEnd) {
    el.scrollTo({ left: 0, behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth' })
    return
  }
  el.scrollBy({ left: delta * sign * slideWidth(), behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth' })
}

function onScroll() {
  const el = track.value
  if (!el) return
  current.value = Math.min(props.count - 1, Math.round(Math.abs(el.scrollLeft) / Math.max(1, slideWidth())))
}

function onKey(e: KeyboardEvent) {
  const forward = dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  const backward = dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  if (e.key === forward) {
    e.preventDefault()
    go(1)
  }
  if (e.key === backward) {
    e.preventDefault()
    go(-1)
  }
}

const playing = computed(() => props.autoplay && reducedMotion.value !== 'reduce' && !paused.value && !hovered.value && !focused.value && props.count > 1)
const { pause, resume } = useIntervalFn(() => go(1), () => props.intervalSeconds * 1000, { immediate: false })
watch(playing, on => (on ? resume() : pause()), { immediate: true })
</script>

<template>
  <div
    class="relative"
    role="region"
    aria-roledescription="carousel"
    :aria-label="props.label"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="focused = false"
  >
    <div class="mb-6 flex items-center justify-end gap-2" :class="!props.showArrows && !props.autoplay && 'sr-only'">
      <UButton
        v-if="props.autoplay && reducedMotion !== 'reduce'"
        :icon="paused ? 'i-lucide-play' : 'i-lucide-pause'"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="paused ? t('sections.carousel.play') : t('sections.carousel.pause')"
        @click="paused = !paused"
      />
      <template v-if="props.showArrows && props.count > 1">
        <UButton icon="i-lucide-arrow-left" class="rtl:rotate-180" color="neutral" variant="outline" size="sm" :aria-label="t('sections.carousel.previous')" :aria-controls="uid" @click="go(-1)" />
        <UButton icon="i-lucide-arrow-right" class="rtl:rotate-180" color="neutral" variant="outline" size="sm" :aria-label="t('sections.carousel.next')" :aria-controls="uid" @click="go(1)" />
      </template>
    </div>
    <div
      :id="uid"
      ref="track"
      tabindex="0"
      class="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:scroll-auto [scrollbar-width:thin]"
      :aria-live="playing ? 'off' : 'polite'"
      @keydown="onKey"
      @scroll.passive="onScroll"
    >
      <div
        v-for="i in props.count"
        :key="i"
        data-slide
        role="group"
        aria-roledescription="slide"
        :aria-label="t('sections.carousel.slideOf', { n: i, total: props.count })"
        class="shrink-0 snap-start"
        :class="props.slideClass"
      >
        <slot :index="i - 1" :active="current === i - 1" />
      </div>
    </div>
  </div>
</template>
