<script setup lang="ts">
import { toCssSizes } from '~/utils/image-sizes'

/**
 * Every image: fixed aspect ratio (no layout shift, never stretched) or `fill` (full-bleed
 * backgrounds), object-cover, blur-up from a tiny preview (`lqip`), lazy by default.
 * With a pre-generated `srcset` (site photos, media variants) it is a plain responsive <img>:
 * no image processing at request time. Otherwise @nuxt/image optimises the source.
 * `alt` is required: pass "" only for decorative images, together with `decorative`.
 */
const props = withDefaults(defineProps<{
  src: string
  alt: string
  decorative?: boolean
  srcset?: string
  ratio?: '16/9' | '3/2' | '4/5' | '1/1' | '4/3'
  /** Fill the positioned parent instead of keeping a ratio (heroes, image quotes). */
  fill?: boolean
  lqip?: string
  /** "xs:100vw sm:50vw lg:33vw" — every entry with a breakpoint. */
  sizes?: string
  /** Above-the-fold images: eager + high fetch priority. */
  priority?: boolean
  fit?: 'cover' | 'contain'
  rounded?: boolean
  /** Slow 1.03 zoom when an ancestor with `group` is hovered (offer cards). */
  zoom?: boolean
}>(), {
  decorative: false, srcset: undefined, ratio: '3/2', fill: false, lqip: undefined, sizes: 'xs:100vw sm:50vw lg:33vw',
  priority: false, fit: 'cover', rounded: true, zoom: false,
})

if (import.meta.dev && !props.decorative && !props.alt.trim()) {
  console.warn(`[MzImage] missing alt text for ${props.src} (use decorative for purely decorative images)`)
}

const imgClass = computed(() => [
  'absolute inset-0 size-full',
  props.fit === 'cover' ? 'object-cover' : 'object-contain',
  props.zoom && 'transition-transform duration-(--duration-zoom) ease-(--ease-editorial) group-hover:scale-[1.03] motion-reduce:group-hover:scale-100',
])
</script>

<template>
  <div
    class="overflow-hidden bg-accented"
    :class="[props.fill ? 'absolute inset-0' : 'relative', props.rounded && !props.fill && 'rounded-sm']"
    :style="{ aspectRatio: props.fill ? undefined : props.ratio, backgroundImage: props.lqip ? `url(${props.lqip})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }"
  >
    <img
      v-if="props.srcset"
      :src="props.src"
      :srcset="props.srcset"
      :sizes="toCssSizes(props.sizes)"
      :alt="props.decorative ? '' : props.alt"
      :loading="props.priority ? 'eager' : 'lazy'"
      :fetchpriority="props.priority ? 'high' : 'auto'"
      decoding="async"
      :class="imgClass"
    >
    <NuxtImg
      v-else
      :src="props.src"
      :alt="props.decorative ? '' : props.alt"
      :sizes="props.sizes"
      format="webp"
      :loading="props.priority ? 'eager' : 'lazy'"
      :fetchpriority="props.priority ? 'high' : 'auto'"
      decoding="async"
      :class="imgClass"
    />
  </div>
</template>
