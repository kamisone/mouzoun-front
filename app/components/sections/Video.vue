<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/**
 * A video from the library, or YouTube / Vimeo loaded only when the visitor asks (privacy, no
 * third-party request before the click). Autoplay is always muted and off under reduced motion.
 */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { text, media } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const reducedMotion = usePreferredReducedMotion()
const file = computed(() => media(s.value.media_id))
const poster = computed(() => media(s.value.poster_media_id))
const loaded = ref(false)
const embed = computed(() => {
  const url = String(s.value.url ?? '')
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/)
  if (s.value.provider === 'youtube' && yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1${s.value.loop ? `&loop=1&playlist=${yt[1]}` : ''}`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (s.value.provider === 'vimeo' && vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&dnt=1${s.value.loop ? '&loop=1' : ''}`
  return null
})
const autoplay = computed(() => !!s.value.autoplay_muted && reducedMotion.value !== 'reduce')
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <figure>
      <div class="relative aspect-video overflow-hidden rounded-sm bg-accented">
        <video
          v-if="s.provider === 'file' && file"
          class="size-full object-cover"
          :src="file.url"
          :poster="poster?.url"
          controls
          playsinline
          preload="metadata"
          :autoplay="autoplay"
          :muted="autoplay"
          :loop="!!s.loop"
        />
        <iframe v-else-if="embed && loaded" class="size-full" :src="embed" :title="text(props.section.content.title) || t('sections.video.title')" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" />
        <button v-else-if="embed" type="button" class="group absolute inset-0 flex items-center justify-center" @click="loaded = true">
          <MzMedia v-if="poster" :media="poster" fill decorative :rounded="false" />
          <span class="relative inline-flex items-center gap-3 rounded-full bg-default px-6 py-3 text-small font-medium shadow-overlay">
            <UIcon name="i-lucide-play" class="size-5" aria-hidden="true" />{{ t('sections.video.play', { provider: s.provider === 'youtube' ? 'YouTube' : 'Vimeo' }) }}
          </span>
        </button>
      </div>
      <figcaption v-if="props.section.content.caption" class="mt-4 text-small text-muted">{{ text(props.section.content.caption) }}</figcaption>
    </figure>
  </MzSectionContainer>
</template>
