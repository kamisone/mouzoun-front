<script setup lang="ts">
/** Full-bleed photograph with a quote in the display serif over a soft scrim. */
const props = withDefaults(defineProps<{
  quote: string
  author?: string
  origin?: string
  image: string
  imageSrcset?: string
  imageAlt?: string
  lqip?: string
}>(), { author: undefined, origin: undefined, imageSrcset: undefined, imageAlt: '', lqip: undefined })
</script>

<template>
  <figure class="dark relative isolate flex min-h-[80svh] items-center overflow-hidden bg-default">
    <div class="absolute inset-0 -z-10">
      <MzImage fill :src="props.image" :srcset="props.imageSrcset" :alt="props.imageAlt" :decorative="!props.imageAlt" :lqip="props.lqip" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw" />
      <div class="absolute inset-0 bg-default/45" aria-hidden="true" />
    </div>
    <MzContainer size="narrow" class="py-24 text-center lg:py-40">
      <MzReveal>
        <blockquote class="font-display text-display-lg text-balance text-highlighted italic">“{{ props.quote }}”</blockquote>
        <figcaption v-if="props.author" class="eyebrow mt-8 text-highlighted">
          {{ props.author }}<template v-if="props.origin"> · {{ props.origin }}</template>
        </figcaption>
      </MzReveal>
    </MzContainer>
  </figure>
</template>
