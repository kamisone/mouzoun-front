<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/**
 * A video from the library, or YouTube / Vimeo loaded only when the visitor asks (privacy, no
 * third-party request before the click). Autoplay is always muted and off under reduced motion.
 * The player itself is `MzVideoPlayer` (shared with the product galleries).
 */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { text, media } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const file = computed(() => media(s.value.media_id))
const poster = computed(() => media(s.value.poster_media_id))
const embed = computed(() => {
  const url = String(s.value.url ?? '')
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/)
  if (s.value.provider === 'youtube' && yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1${s.value.loop ? `&loop=1&playlist=${yt[1]}` : ''}`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (s.value.provider === 'vimeo' && vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&dnt=1${s.value.loop ? '&loop=1' : ''}`
  return null
})
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <figure>
      <div class="aspect-video overflow-hidden rounded-sm">
        <MzVideoPlayer
          :src="s.provider === 'file' ? file?.url : null"
          :embed="s.provider === 'file' ? null : embed"
          :poster="poster"
          :title="text(props.section.content.title) || t('sections.video.title')"
          :play-label="t('sections.video.play', { provider: s.provider === 'youtube' ? 'YouTube' : 'Vimeo' })"
          :autoplay-muted="!!s.autoplay_muted"
          :loop="!!s.loop"
        />
      </div>
      <figcaption v-if="props.section.content.caption" class="mt-4 text-small text-muted">{{ text(props.section.content.caption) }}</figcaption>
    </figure>
  </MzSectionContainer>
</template>
