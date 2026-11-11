<script setup lang="ts">
/**
 * Large image + text, on the 12-column grid (image 6 columns, a column of air, text 5).
 * `reverse` puts the image on the end side; alternate it down the page.
 */
const props = withDefaults(defineProps<{
  id?: string
  eyebrow?: string
  title: string
  image: string
  imageSrcset?: string
  imageAlt: string
  lqip?: string
  ratio?: '4/5' | '3/2'
  reverse?: boolean
}>(), { id: undefined, eyebrow: undefined, imageSrcset: undefined, lqip: undefined, ratio: '4/5', reverse: false })
</script>

<template>
  <section :id="props.id" class="py-16 md:py-24 lg:py-32">
    <MzContainer class="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
      <MzReveal class="lg:col-span-6" :class="props.reverse ? 'lg:order-2 lg:col-start-7' : 'lg:col-start-1'">
        <MzImage :src="props.image" :srcset="props.imageSrcset" :alt="props.imageAlt" :lqip="props.lqip" :ratio="props.ratio" sizes="xs:100vw lg:50vw" />
      </MzReveal>
      <MzReveal :index="1" class="lg:col-span-5" :class="props.reverse ? 'lg:order-1 lg:col-start-1 lg:row-start-1' : 'lg:col-start-8'">
        <p v-if="props.eyebrow" class="eyebrow mb-4">{{ props.eyebrow }}</p>
        <h2 class="text-h1 text-balance">{{ props.title }}</h2>
        <div class="mt-6 flex flex-col gap-4 text-body text-toned">
          <slot />
        </div>
        <div v-if="$slots.actions" class="mt-8">
          <slot name="actions" />
        </div>
      </MzReveal>
    </MzContainer>
  </section>
</template>
