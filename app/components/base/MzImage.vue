<script setup lang="ts">
/**
 * Every image of the site: optimised by @nuxt/image (AVIF/WebP, srcset), lazy by default,
 * reserved space through `ratio` (no layout shift), warm placeholder colour behind it while it
 * loads (no JavaScript: works for images that load before hydration).
 * `alt` is required: pass "" only for decorative images, together with `decorative`.
 */
const props = withDefaults(defineProps<{
  src: string
  alt: string
  decorative?: boolean
  /** CSS aspect ratio, e.g. "4/3", "16/9", "1/1". */
  ratio?: string
  /** `sizes` for srcset, e.g. "100vw sm:50vw lg:400px". */
  sizes?: string
  /** Above-the-fold images (hero): eager + high fetch priority. */
  priority?: boolean
  fit?: 'cover' | 'contain'
  rounded?: boolean
}>(), { decorative: false, ratio: '4/3', sizes: '100vw sm:50vw lg:33vw', priority: false, fit: 'cover', rounded: true })

if (import.meta.dev && !props.decorative && !props.alt.trim()) {
  console.warn(`[MzImage] missing alt text for ${props.src} (use decorative for purely decorative images)`)
}
</script>

<template>
  <div
    class="relative overflow-hidden bg-accented"
    :class="props.rounded && 'rounded-lg'"
    :style="{ aspectRatio: props.ratio }"
  >
    <NuxtImg
      :src="props.src"
      :alt="props.decorative ? '' : props.alt"
      :sizes="props.sizes"
      :loading="props.priority ? 'eager' : 'lazy'"
      :fetchpriority="props.priority ? 'high' : 'auto'"
      decoding="async"
      class="absolute inset-0 size-full"
      :class="props.fit === 'cover' ? 'object-cover' : 'object-contain'"
    />
  </div>
</template>
