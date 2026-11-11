<script setup lang="ts">
/**
 * Full-bleed hero: image or video background, darkening overlay for legible text, eyebrow,
 * title (the page's <h1>), description and calls to action. Height is reserved up front (no
 * layout shift); the video never autoplays when reduced motion is requested.
 */
const props = withDefaults(defineProps<{
  title: string
  eyebrow?: string
  description?: string
  image?: string
  imageAlt?: string
  video?: string
  /** Darkness of the overlay over the media. */
  overlay?: 'light' | 'medium' | 'strong'
  height?: 'md' | 'lg' | 'screen'
  align?: 'start' | 'center'
}>(), {
  eyebrow: undefined, description: undefined, image: undefined, imageAlt: '', video: undefined,
  overlay: 'medium', height: 'lg', align: 'start',
})

const reducedMotion = usePreferredReducedMotion()
const playVideo = computed(() => !!props.video && reducedMotion.value !== 'reduce')
const heights = { md: 'min-h-[28rem]', lg: 'min-h-[36rem] md:min-h-[42rem]', screen: 'min-h-[calc(100svh-var(--ui-header-height))]' }
// With media, the hero is a local `dark` scope: bg-default is the desert-night background,
// so the overlay is always dark behind the light text, in both site themes.
const overlays = { light: 'bg-default/40', medium: 'bg-default/60', strong: 'bg-default/75' }
const hasMedia = computed(() => !!props.image || !!props.video)
</script>

<template>
  <section
    class="relative isolate flex items-end overflow-hidden"
    :class="[heights[props.height], hasMedia ? 'dark text-default' : 'bg-muted']"
  >
    <div v-if="hasMedia" class="absolute inset-0 -z-10" aria-hidden="true">
      <video
        v-if="playVideo"
        class="size-full object-cover"
        :src="props.video"
        :poster="props.image"
        autoplay
        muted
        loop
        playsinline
      />
      <NuxtImg
        v-else-if="props.image"
        :src="props.image"
        alt=""
        sizes="100vw"
        loading="eager"
        fetchpriority="high"
        class="size-full object-cover"
      />
      <div class="absolute inset-0" :class="overlays[props.overlay]" />
    </div>

    <MzContainer class="py-(--section-y)">
      <div class="max-w-2xl" :class="props.align === 'center' && 'mx-auto text-center'">
        <p v-if="props.eyebrow" class="mb-3 text-sm font-semibold tracking-wide uppercase" :class="hasMedia ? 'text-highlighted/90' : 'text-primary'">
          {{ props.eyebrow }}
        </p>
        <h1 class="font-display text-4xl font-semibold tracking-tight text-balance text-highlighted sm:text-5xl lg:text-6xl">
          {{ props.title }}
        </h1>
        <p v-if="props.description" class="mt-5 text-lg text-pretty sm:text-xl" :class="hasMedia ? 'text-highlighted/90' : 'text-muted'">
          {{ props.description }}
        </p>
        <div v-if="$slots.actions" class="mt-8 flex flex-wrap gap-3" :class="props.align === 'center' && 'justify-center'">
          <slot name="actions" />
        </div>
      </div>
    </MzContainer>
  </section>
</template>
