<script setup lang="ts">
import type { MediaView } from '~/utils/page-types'
import { blurhashColor, srcsetOf } from '~/utils/page-builder'

/**
 * A media of the library: pre-generated variants as a responsive <img> (no processing at
 * request time), blur-up placeholder (data URI, else the blurhash colour), focal point as
 * object-position, lazy unless `priority` (the hero: eager + fetchpriority=high + preload).
 */
const props = withDefaults(defineProps<{
  media: MediaView
  /** Text that overrides the library's description. */
  alt?: string | null
  decorative?: boolean
  ratio?: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  fit?: 'cover' | 'contain'
  rounded?: boolean
}>(), { alt: null, decorative: false, ratio: undefined, fill: false, sizes: '100vw', priority: false, fit: 'cover', rounded: true }) // lint-tokens-ignore (native sizes, not @nuxt/image)

const srcset = computed(() => srcsetOf(props.media))
const alt = computed(() => (props.decorative ? '' : (props.alt || props.media.alt || '')))
const ratio = computed(() => props.ratio ?? (props.media.width && props.media.height ? `${props.media.width}/${props.media.height}` : '3/2'))

if (props.priority) {
  useHead({
    link: [{ rel: 'preload', as: 'image', href: props.media.url, imagesrcset: srcset.value, imagesizes: props.sizes, fetchpriority: 'high' }],
  })
}
</script>

<template>
  <div
    class="overflow-hidden bg-accented"
    :class="[props.fill ? 'absolute inset-0' : 'relative', props.rounded && !props.fill && 'rounded-sm']"
    :style="{
      aspectRatio: props.fill ? undefined : ratio,
      backgroundColor: blurhashColor(props.media.blurhash),
      backgroundImage: props.media.placeholder ? `url(${props.media.placeholder})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: props.media.position ?? 'center',
    }"
  >
    <img
      :src="props.media.url"
      :srcset="srcset"
      :sizes="srcset ? props.sizes : undefined"
      :width="props.media.width ?? undefined"
      :height="props.media.height ?? undefined"
      :alt="alt"
      :loading="props.priority ? 'eager' : 'lazy'"
      :fetchpriority="props.priority ? 'high' : 'auto'"
      decoding="async"
      class="absolute inset-0 size-full"
      :class="props.fit === 'cover' ? 'object-cover' : 'object-contain'"
      :style="{ objectPosition: props.media.position ?? undefined }"
    >
  </div>
</template>
