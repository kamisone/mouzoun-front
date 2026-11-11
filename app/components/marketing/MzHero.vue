<script setup lang="ts">
/**
 * Full-viewport photo (or muted looping video) with a bottom scrim, the headline bottom-left
 * (display-xl, the page's <h1>), one line of text, one call to action and a discreet scroll cue.
 * Space is reserved up front (no layout shift); the video never plays under reduced motion.
 */
const props = withDefaults(defineProps<{
  title: string
  eyebrow?: string
  description?: string
  image: string
  imageSrcset?: string
  imageAlt?: string
  lqip?: string
  video?: string
  /** Where the scroll cue leads (id of the next section). */
  next?: string
}>(), { eyebrow: undefined, description: undefined, imageSrcset: undefined, imageAlt: '', lqip: undefined, video: undefined, next: undefined })

const { t } = useI18n()
const reducedMotion = usePreferredReducedMotion()
const playVideo = computed(() => !!props.video && reducedMotion.value !== 'reduce')
</script>

<template>
  <!-- Local `dark` scope: ivory text over the photo in both site themes. -->
  <section class="dark relative isolate flex min-h-svh items-end overflow-hidden bg-default">
    <div class="absolute inset-0 -z-10">
      <video v-if="playVideo" class="size-full object-cover" :src="props.video" :poster="props.image" autoplay muted loop playsinline aria-hidden="true" />
      <MzImage
        v-else
        fill
        priority
        :src="props.image"
        :srcset="props.imageSrcset"
        :alt="props.imageAlt"
        :decorative="!props.imageAlt"
        :lqip="props.lqip"
        sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw"
      />
      <!-- Scrim: the only gradient of the site, for legibility of text on photos. -->
      <div class="absolute inset-0 bg-linear-to-t from-default/85 via-default/25 to-default/10" aria-hidden="true" />
    </div>

    <MzContainer class="pb-16 pt-40 lg:pb-24">
      <div class="max-w-4xl">
        <p v-if="props.eyebrow" class="eyebrow mb-6 text-highlighted">{{ props.eyebrow }}</p>
        <h1 class="text-display-xl text-balance">{{ props.title }}</h1>
        <p v-if="props.description" class="mt-6 max-w-editorial text-body-lg text-highlighted">{{ props.description }}</p>
        <!-- `light` scope: the call to action keeps the true accent over the photo. -->
        <div v-if="$slots.actions" class="light mt-12 flex flex-wrap items-center gap-6">
          <slot name="actions" />
        </div>
      </div>
      <a
        v-if="props.next"
        :href="`#${props.next}`"
        class="absolute end-6 bottom-16 hidden flex-col items-center gap-3 text-caption tracking-label text-highlighted uppercase lg:end-12 lg:bottom-24 lg:flex"
      >
        <span class="[writing-mode:vertical-rl]">{{ t('common.scroll') }}</span>
        <span class="h-12 w-px bg-inverted/60" aria-hidden="true" />
      </a>
    </MzContainer>
  </section>
</template>
