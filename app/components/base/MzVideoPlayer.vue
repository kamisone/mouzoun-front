<script setup lang="ts">
/**
 * The site's video player (page-builder video section, product galleries).
 *
 * - A library file plays in a native `<video>` with controls. `deferred`: nothing is loaded until
 *   the visitor taps the poster (no request, no autoplay); the tap starts playback with sound,
 *   since the visitor asked for it.
 * - YouTube / Vimeo (`embed`) always wait for the tap (privacy: no third-party request before).
 * - Autoplay only ever muted (`autoplayMuted`), and never under reduced motion.
 */
const props = withDefaults(defineProps<{
  src?: string | null
  embed?: string | null
  poster?: { url: string } | null
  title: string
  /** Label of the play button ("Lire la vidéo"). */
  playLabel: string
  deferred?: boolean
  autoplayMuted?: boolean
  loop?: boolean
}>(), { src: null, embed: null, poster: null, deferred: false, autoplayMuted: false, loop: false })
const reducedMotion = usePreferredReducedMotion()
const started = ref(false)
const player = useTemplateRef<HTMLVideoElement>('player')
const autoplay = computed(() => props.autoplayMuted && !props.deferred && reducedMotion.value !== 'reduce')
const waiting = computed(() => !started.value && (!!props.embed || (props.deferred && !!props.src)))
async function start() {
  started.value = true
  await nextTick()
  // A tap is a request to play: start at once (with sound), keep the controls.
  player.value?.play().catch(() => undefined)
}
</script>

<template>
  <div class="relative size-full overflow-hidden bg-accented" data-testid="video-player">
    <button v-if="waiting" type="button" class="group absolute inset-0 flex items-center justify-center" :aria-label="`${props.playLabel} — ${props.title}`" data-testid="video-play" @click="start">
      <MzImage v-if="props.poster" :src="props.poster.url" alt="" fill decorative />
      <span class="relative inline-flex items-center gap-3 rounded-full bg-default px-6 py-3 text-small font-medium shadow-overlay">
        <UIcon name="i-lucide-play" class="size-5" aria-hidden="true" />{{ props.playLabel }}
      </span>
    </button>
    <iframe v-else-if="props.embed" class="size-full" :src="props.embed" :title="props.title" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" />
    <video
      v-else-if="props.src"
      ref="player"
      class="size-full object-cover"
      :src="props.src"
      :poster="props.poster?.url"
      :title="props.title"
      controls
      playsinline
      :preload="props.deferred ? 'auto' : 'metadata'"
      :autoplay="autoplay"
      :muted="autoplay"
      :loop="props.loop"
    />
  </div>
</template>
