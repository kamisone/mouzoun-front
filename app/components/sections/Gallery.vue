<script setup lang="ts">
import type { GalleryData, MediaView, RenderedSection } from '~/utils/page-types'

/**
 * Compact photo gallery: a fixed-height preview (mosaic of 5, mosaic of 3, one cover photo or a
 * filmstrip; one swipeable 4:3 photo on phones), a "View all N photos" button and album chips.
 * Only the preview photos are in the page; the full set opens in a full-screen viewer organised
 * in albums (loaded on demand, its code too), then in a lightbox. The viewer state lives in the
 * URL hash, so a photo can be shared and the back button closes the lightbox, then the viewer.
 */
const GalleryViewer = defineAsyncComponent(() => import('~/components/gallery/GalleryViewer.vue'))

const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
/** Native `sizes` (pre-generated variants, not @nuxt/image). */
const FULL_WIDTH = '100vw' // lint-tokens-ignore
const route = useRoute()
const { text, media, level } = useSectionContext(() => props.section)
const { track } = useAnalytics()

interface Tile { media: MediaView, album: string }

const s = computed(() => props.section.settings)
const data = computed(() => props.section.data as unknown as Partial<GalleryData>)
const albums = computed(() => data.value.albums ?? [])
const photos = computed<Tile[]>(() => (data.value.preview ?? [])
  .map(p => ({ media: media(p.media_id), album: p.album_id }))
  .filter((p): p is Tile => !!p.media))
const total = computed(() => Math.max(data.value.total_count ?? 0, photos.value.length))
const title = computed(() => text(props.section.content.title))
const priority = computed(() => props.index === 0)
const height = computed(() => ({ sm: 'md:h-80', md: 'md:h-110', lg: 'md:h-140' } as Record<string, string>)[s.value.preview_height as string] ?? 'md:h-110')

/** The layout actually drawn: a mosaic falls back to fewer cells when there are fewer photos. */
const shape = computed(() => {
  const n = photos.value.length
  const layout = (s.value.preview_layout as string) ?? 'mosaic'
  if (layout === 'filmstrip' && n > 1) return 'filmstrip'
  if (layout === 'cover' || n <= 1) return 'cover'
  if (layout === 'mosaic' && n >= 5) return 'mosaic'
  if (n >= 3) return 'mosaic_3'
  return 'pair'
})
const tiles = computed(() => photos.value.slice(0, { mosaic: 5, mosaic_3: 3, pair: 2, cover: 1, filmstrip: 12 }[shape.value]))
const gridClass = computed(() => ({
  mosaic: 'grid-cols-4 grid-rows-2',
  mosaic_3: 'grid-cols-3 grid-rows-2',
  pair: 'grid-cols-2 grid-rows-1',
} as Record<string, string>)[shape.value] ?? '')
const bigCell = (i: number) => i === 0 && (shape.value === 'mosaic' || shape.value === 'mosaic_3') ? 'col-span-2 row-span-2' : ''
const sizes = (i: number) => i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 100vw' // lint-tokens-ignore (native sizes, not @nuxt/image)

const buttonLabel = computed(() => {
  const custom = text(props.section.content.view_all_label)
  if (s.value.show_count === false) {
    return custom.replace(/\s*\(?\{count\}\)?\s*/g, ' ').trim() || t('sections.gallery.viewAll')
  }
  return custom ? custom.replace('{count}', String(total.value)) : t('sections.gallery.viewAllCount', { count: total.value })
})
const buttonAria = computed(() => t('sections.gallery.viewAllAria', { count: total.value }))
const altOf = (m: MediaView) => m.alt ?? ''

// ---- Viewer (URL hash) ----------------------------------------------------------------------
const key = computed(() => props.section.anchor_id || props.section.id)
const viewer = useGalleryRoute(() => key.value)
const previewToken = computed(() => (typeof route.query.preview === 'string' ? route.query.preview : undefined))
let opener: HTMLElement | null = null

const albumNumber = (id: string | null | undefined) => {
  const i = albums.value.findIndex(a => a.id === id)
  return i >= 0 ? i + 1 : null
}
function remember() {
  if (import.meta.client) opener = document.activeElement as HTMLElement | null
}
function openViewer(album: number | null = null) {
  remember()
  viewer.open(album)
}
function openTile(tile: Tile) {
  remember()
  if (s.value.open_lightbox_directly) viewer.open(albumNumber(tile.album), tile.media.id)
  else viewer.open(albumNumber(tile.album))
}
watch(() => viewer.state.value.open, (open) => {
  if (open) {
    track('gallery_open', { section: props.section.analytics_label ?? props.section.id })
  }
  else {
    // Back to the photo or button that opened it.
    nextTick(() => opener?.focus?.())
  }
})

// ---- Phones: one swipeable photo ------------------------------------------------------------
const strip = useTemplateRef<HTMLElement>('strip')
const current = ref(0)
function onSwipe() {
  const el = strip.value
  if (!el || !el.clientWidth) return
  current.value = Math.min(photos.value.length - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth))
}

// ---- Filmstrip arrows (desktop) -------------------------------------------------------------
const film = useTemplateRef<HTMLElement>('film')
const dir = useTextDirection({ selector: 'html' })
function scrollFilm(delta: number) {
  const el = film.value
  if (!el) return
  const sign = dir.value === 'rtl' ? -1 : 1
  el.scrollBy({ left: sign * delta * el.clientWidth * 0.8, behavior: 'smooth' })
}
</script>

<template>
  <MzSectionContainer :section="props.section">
    <div :class="shape === 'cover' && 'md:hidden'">
      <MzSectionHeading :section="props.section" />
    </div>

    <!-- Phones: one 4:3 photo at a time, swipeable, with "1 / N" and dots for the first five. -->
    <div class="md:hidden" data-testid="gallery-mobile">
      <div class="relative overflow-hidden rounded-md">
        <div ref="strip" class="flex aspect-4/3 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]" @scroll.passive="onSwipe">
          <button
            v-for="(p, i) in photos"
            :key="p.media.id"
            type="button"
            class="relative block h-full w-full shrink-0 snap-center"
            :aria-label="t('sections.gallery.open', { alt: altOf(p.media) })"
            @click="openTile(p)"
          >
            <MzMedia :media="p.media" fill :rounded="false" :sizes="FULL_WIDTH" :priority="priority && i === 0" />
          </button>
          <div v-if="!photos.length" class="h-full w-full bg-accented" />
        </div>
        <span v-if="total" class="absolute end-3 top-3 rounded-full bg-default/90 px-2 py-1 text-caption tabular-nums" data-testid="gallery-counter" aria-hidden="true">
          {{ current + 1 }} / {{ total }}
        </span>
        <div v-if="photos.length > 1" class="absolute inset-x-0 bottom-3 flex justify-center gap-1" aria-hidden="true">
          <span v-for="(p, i) in photos.slice(0, 5)" :key="p.media.id" class="size-2 rounded-full bg-default transition-opacity" :class="i === Math.min(current, 4) ? 'opacity-100' : 'opacity-50'" />
        </div>
      </div>
      <UButton :label="buttonLabel" :aria-label="buttonAria" icon="i-lucide-images" color="neutral" variant="outline" block class="mt-4" data-testid="gallery-view-all" @click="openViewer()" />
    </div>

    <!-- Larger screens: fixed height, whatever the number of photos. -->
    <div class="relative hidden md:block" :class="height" data-testid="gallery-preview" :data-layout="shape">
      <div v-if="!photos.length" class="size-full rounded-md bg-accented" />

      <div v-else-if="shape === 'filmstrip'" class="relative h-full">
        <div ref="film" class="mz-fade-x flex h-full snap-x gap-2 overflow-x-auto [scrollbar-width:none]">
          <button
            v-for="(p, i) in tiles"
            :key="p.media.id"
            type="button"
            class="group relative h-full shrink-0 snap-start overflow-hidden rounded-md"
            :aria-label="t('sections.gallery.open', { alt: altOf(p.media) })"
            @click="openTile(p)"
          >
            <MzMedia
              :media="p.media"
              :rounded="false"
              :ratio="p.media.width && p.media.height ? `${p.media.width}/${p.media.height}` : '3/2'"
              class="h-full transition-transform duration-300 group-hover:scale-103 motion-reduce:transform-none"
              sizes="(min-width: 768px) 40vw, 100vw"
              :priority="priority && i === 0"
            />
          </button>
          <button type="button" class="flex h-full w-60 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-md border border-default bg-muted text-small font-medium" :aria-label="buttonAria" data-testid="gallery-view-all-desktop" @click="openViewer()">
            <UIcon name="i-lucide-images" class="size-6" aria-hidden="true" />
            {{ buttonLabel }}
          </button>
        </div>
        <UButton icon="i-lucide-chevron-left" color="neutral" variant="outline" class="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-default rtl:rotate-180" :aria-label="t('common.previous')" @click="scrollFilm(-1)" />
        <UButton icon="i-lucide-chevron-right" color="neutral" variant="outline" class="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-default rtl:rotate-180" :aria-label="t('common.next')" @click="scrollFilm(1)" />
      </div>

      <div v-else-if="shape === 'cover'" class="relative h-full overflow-hidden rounded-md">
        <button type="button" class="group absolute inset-0 block" :aria-label="t('sections.gallery.open', { alt: altOf(tiles[0]!.media) })" @click="openTile(tiles[0]!)">
          <MzMedia :media="tiles[0]!.media" fill :rounded="false" :sizes="FULL_WIDTH" :priority="priority" class="transition-transform duration-300 group-hover:scale-103 motion-reduce:transform-none" />
        </button>
        <div class="mz-photo-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
        <div class="dark pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-8 text-default">
          <component :is="`h${level}`" v-if="title" class="max-w-editorial text-balance text-h2">{{ title }}</component>
          <UButton :label="buttonLabel" :aria-label="buttonAria" icon="i-lucide-images" color="neutral" variant="solid" class="pointer-events-auto light shadow-lifted" data-testid="gallery-view-all-desktop" @click="openViewer()" />
        </div>
      </div>

      <div v-else class="grid h-full gap-2 overflow-hidden rounded-md" :class="gridClass">
        <button
          v-for="(p, i) in tiles"
          :key="p.media.id"
          type="button"
          class="group relative overflow-hidden"
          :class="bigCell(i)"
          :aria-label="t('sections.gallery.open', { alt: altOf(p.media) })"
          @click="openTile(p)"
        >
          <MzMedia :media="p.media" fill :rounded="false" :sizes="sizes(i)" :priority="priority && i === 0" class="transition-transform duration-300 group-hover:scale-103 motion-reduce:transform-none" />
        </button>
        <UButton :label="buttonLabel" :aria-label="buttonAria" icon="i-lucide-images" color="neutral" variant="solid" class="light absolute bottom-4 end-4 shadow-lifted" data-testid="gallery-view-all-desktop" @click="openViewer()" />
      </div>
    </div>

    <ul v-if="s.show_album_chips !== false && albums.length > 1" class="mt-4 flex flex-wrap gap-2" :aria-label="t('sections.gallery.albums')">
      <li v-for="(a, i) in albums" :key="a.id">
        <button type="button" class="rounded-full border border-default px-3 py-1 text-small transition-colors hover:bg-muted" :data-testid="`gallery-chip-${i + 1}`" @click="openViewer(i + 1)">
          {{ a.title }} <span class="text-muted tabular-nums">{{ a.count }}</span>
        </button>
      </li>
    </ul>

    <GalleryViewer
      v-if="viewer.state.value.open"
      :section-id="props.section.id"
      :title="title || t('sections.gallery.title')"
      :albums="albums"
      :total="total"
      :settings="s"
      :album="viewer.state.value.album"
      :photo="viewer.state.value.photo"
      :preview-token="previewToken"
      :analytics-label="props.section.analytics_label ?? props.section.id"
      :share-key="key"
      @album="n => viewer.setAlbum(n)"
      @photo="id => viewer.openPhoto(id)"
      @close-photo="viewer.closePhoto()"
      @close="viewer.close()"
    />
  </MzSectionContainer>
</template>
