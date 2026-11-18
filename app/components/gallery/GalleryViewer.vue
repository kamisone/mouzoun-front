<script setup lang="ts">
import type { GalleryAlbum, GalleryPhoto, Json } from '~/utils/page-types'

/**
 * Full-screen viewer of a gallery section (loaded only when opened): sticky header with the
 * album tabs, then each album with its title, description and an editorial grid (one wide photo,
 * two half ones, repeated), or one continuous grid (`viewer_layout: stream`). Photos come from
 * `GET /v1/sections/{id}/gallery`, 24 at a time, as the reader scrolls. A photo opens the
 * lightbox. The album and the photo live in the URL (see useGalleryRoute).
 */
const GalleryLightbox = defineAsyncComponent(() => import('~/components/gallery/GalleryLightbox.vue'))

const props = defineProps<{
  sectionId: string
  title: string
  albums: GalleryAlbum[]
  total: number
  settings: Json
  /** 1-based album of the URL. */
  album: number | null
  photo: string | null
  previewToken?: string
  analyticsLabel: string
  shareKey: string
}>()
const emit = defineEmits<{ album: [n: number | null], photo: [id: string], closePhoto: [], close: [] }>()
const { t, locale } = useI18n()
const galleryApi = useGalleryApi()
const { track } = useAnalytics()
const toast = useToast()

const stream = computed(() => props.settings.viewer_layout === 'stream')
const STREAM = '__all__'

interface Feed { items: GalleryPhoto[], cursor: string | null, done: boolean, loading: boolean, error: boolean }
const feeds = reactive<Record<string, Feed>>({})
const albumList = ref(props.albums)
const feedOf = (id: string) => (feeds[id] ??= { items: [], cursor: null, done: false, loading: false, error: false })

async function load(id: string) {
  const feed = feedOf(id)
  if (feed.loading || feed.done) return
  feed.loading = true
  feed.error = false
  try {
    const page = await galleryApi.page(props.sectionId, {
      locale: locale.value,
      album: id === STREAM ? undefined : id,
      cursor: feed.cursor ?? undefined,
      limit: 24,
      preview: props.previewToken,
    })
    if (page.albums) {
      albumList.value = page.albums.map(a => ({ id: a.id, title: a.title, description: a.description, count: a.count, cover_media_id: a.cover?.id ?? null, hidden_in_preview: false }))
    }
    feed.items.push(...page.items)
    feed.cursor = page.next_cursor
    feed.done = !page.next_cursor
  }
  catch {
    feed.error = true
  }
  finally {
    feed.loading = false
  }
}

const currentAlbumId = computed(() => (props.album ? albumList.value[props.album - 1]?.id : undefined) ?? albumList.value[0]?.id ?? null)

// ---- Lightbox: which list it walks through ------------------------------------------------------
/** The album of the open photo (albums mode), or the whole set (stream). */
const lightboxFeed = computed(() => {
  if (stream.value) return STREAM
  if (!props.photo) return currentAlbumId.value ?? STREAM
  const holder = Object.entries(feeds).find(([, f]) => f.items.some(i => i.media.id === props.photo))
  return holder?.[0] ?? currentAlbumId.value ?? STREAM
})
const lightboxItems = computed(() => feeds[lightboxFeed.value]?.items ?? [])
const lightboxTotal = computed(() => stream.value ? props.total : albumList.value.find(a => a.id === lightboxFeed.value)?.count ?? lightboxItems.value.length)

/** A shared link to a photo: load its album until the photo is there (a few pages at most). */
async function reach(photo: string) {
  const id = lightboxFeed.value
  for (let i = 0; i < 10 && !feedOf(id).items.some(x => x.media.id === photo) && !feedOf(id).done; i++) await load(id)
}

// ---- Albums: tabs follow the scroll -------------------------------------------------------------
const scroller = useTemplateRef<HTMLElement>('scroller')
const visibleAlbum = ref<string | null>(null)
let observer: IntersectionObserver | null = null
let loader: IntersectionObserver | null = null
let jumping = false

function blockOf(id: string) {
  return scroller.value?.querySelector<HTMLElement>(`[data-album="${id}"]`)
}
function goTo(index: number) {
  const a = albumList.value[index]
  if (!a) return
  emit('album', index + 1)
  if (stream.value) return
  jumping = true
  visibleAlbum.value = a.id
  void load(a.id)
  blockOf(a.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  setTimeout(() => (jumping = false), 800)
}
watch(visibleAlbum, (id, old) => {
  if (!id || id === old) return
  track('gallery_album_view', { section: props.analyticsLabel, album: id })
  const n = albumList.value.findIndex(a => a.id === id)
  if (!jumping && n >= 0) emit('album', n + 1)
})

/** Rows of three: one wide photo, then two half ones. */
const wide = (i: number) => i % 3 === 0

function observe() {
  observer?.disconnect()
  loader?.disconnect()
  const root = scroller.value
  if (!root) return
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !jumping) visibleAlbum.value = (e.target as HTMLElement).dataset.album ?? null
    }
  }, { root, rootMargin: '-30% 0px -60% 0px' })
  loader = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) void load((e.target as HTMLElement).dataset.feed!)
    }
  }, { root, rootMargin: '600px 0px' })
  root.querySelectorAll<HTMLElement>('[data-album]').forEach(el => observer!.observe(el))
  root.querySelectorAll<HTMLElement>('[data-feed]').forEach(el => loader!.observe(el))
}

// ---- Dialog: focus trap, scroll lock, Escape ------------------------------------------------------
const dialog = useTemplateRef<HTMLElement>('dialog')
const lock = useScrollLock(import.meta.client ? document.body : null)
function onKey(e: KeyboardEvent) {
  if (props.photo) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
  if (e.key === 'Tab' && dialog.value) trapFocus(dialog.value, e)
}

async function share() {
  const url = `${location.origin}${location.pathname}${location.search}${galleryHash(props.shareKey, { album: props.album, photo: null })}`
  track('gallery_share', { section: props.analyticsLabel })
  if (await shareLink({ title: props.title, url }) === 'copied') toast.add({ title: t('sections.gallery.linkCopied'), icon: 'i-lucide-link' })
}

onMounted(async () => {
  lock.value = true
  dialog.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  const first = stream.value ? STREAM : currentAlbumId.value
  if (first) await load(first)
  if (!stream.value && props.album && props.album > 1) {
    await nextTick()
    blockOf(currentAlbumId.value!)?.scrollIntoView({ block: 'start' })
  }
  visibleAlbum.value = stream.value ? null : currentAlbumId.value
  await nextTick()
  observe()
  if (props.photo) await reach(props.photo)
})
watch(() => props.photo, (id) => {
  if (id) void reach(id)
})
onBeforeUnmount(() => {
  lock.value = false
  observer?.disconnect()
  loader?.disconnect()
})
watch(() => albumList.value.length, () => nextTick(observe))
</script>

<template>
  <Teleport to="body">
    <div
      ref="dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="props.title"
      class="fixed inset-0 z-(--z-modal) flex flex-col bg-default text-default"
      data-testid="gallery-viewer"
      @keydown="onKey"
    >
      <header class="z-(--z-raised) shrink-0 border-b border-default bg-default">
        <div class="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" class="rtl:rotate-180" :aria-label="t('sections.gallery.close')" data-autofocus data-testid="gallery-close" @click="emit('close')" />
          <h2 class="min-w-0 flex-1 truncate text-h4">{{ props.title }}</h2>
          <UButton v-if="props.settings.allow_share !== false" icon="i-lucide-share-2" color="neutral" variant="ghost" :aria-label="t('sections.gallery.share')" @click="share" />
        </div>
        <nav v-if="!stream && albumList.length > 1" class="mx-auto w-full max-w-6xl overflow-x-auto px-4 pb-3 [scrollbar-width:none]" :aria-label="t('sections.gallery.albums')">
          <ul class="flex gap-2">
            <li v-for="(a, i) in albumList" :key="a.id" class="shrink-0">
              <button
                type="button"
                class="rounded-full border px-3 py-1 text-small transition-colors"
                :class="(visibleAlbum ?? currentAlbumId) === a.id ? 'border-primary bg-primary/10 text-primary' : 'border-default hover:bg-muted'"
                :aria-current="(visibleAlbum ?? currentAlbumId) === a.id ? 'true' : undefined"
                :data-testid="`gallery-tab-${i + 1}`"
                @click="goTo(i)"
              >
                {{ a.title }} <span class="tabular-nums opacity-70">{{ a.count }}</span>
              </button>
            </li>
          </ul>
        </nav>
      </header>

      <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
          <!-- One continuous grid. -->
          <template v-if="stream">
            <ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <li v-for="p in feedOf(STREAM).items" :key="p.media.id">
                <button type="button" class="block w-full overflow-hidden rounded-sm" :aria-label="t('sections.gallery.open', { alt: p.media.alt ?? '' })" @click="emit('photo', p.media.id)">
                  <MzMedia :media="p.media" ratio="1/1" :rounded="false" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
                </button>
              </li>
              <template v-if="!feedOf(STREAM).done">
                <li v-for="n in Math.min(8, Math.max(0, props.total - feedOf(STREAM).items.length))" :key="`s${n}`" class="aspect-square animate-pulse rounded-sm bg-accented" aria-hidden="true" />
              </template>
            </ul>
            <div v-if="!feedOf(STREAM).done" data-feed="__all__" class="h-px" />
          </template>

          <!-- Albums, one after the other. -->
          <template v-else>
            <section v-for="a in albumList" :key="a.id" :data-album="a.id" class="scroll-mt-4 pb-12" :aria-labelledby="`album-${a.id}`">
              <h3 :id="`album-${a.id}`" class="text-h3">{{ a.title }}</h3>
              <p v-if="a.description" class="mt-2 max-w-editorial text-body text-muted">{{ a.description }}</p>
              <ul class="mt-6 grid grid-cols-2 gap-2">
                <li v-for="(p, i) in feedOf(a.id).items" :key="p.media.id" :class="wide(i) && 'col-span-2'">
                  <button type="button" class="block w-full overflow-hidden rounded-sm" :aria-label="t('sections.gallery.open', { alt: p.media.alt ?? '' })" :data-testid="`gallery-photo-${p.media.id}`" @click="emit('photo', p.media.id)">
                    <MzMedia :media="p.media" :ratio="wide(i) ? '3/2' : '4/3'" :rounded="false" :sizes="wide(i) ? '(min-width: 1152px) 1152px, 100vw' : '(min-width: 1152px) 576px, 50vw'" />
                  </button>
                </li>
                <template v-if="!feedOf(a.id).done">
                  <li
                    v-for="n in Math.min(6, Math.max(0, a.count - feedOf(a.id).items.length))"
                    :key="`s${n}`"
                    class="animate-pulse rounded-sm bg-accented"
                    :class="wide(feedOf(a.id).items.length + n - 1) ? 'col-span-2 aspect-3/2' : 'aspect-4/3'"
                    aria-hidden="true"
                  />
                </template>
              </ul>
              <div v-if="!feedOf(a.id).done" :data-feed="a.id" class="h-px" />
              <p v-if="feedOf(a.id).error" class="mt-4 text-small text-error" role="alert">
                {{ t('sections.gallery.loadFailed') }}
                <UButton :label="t('sections.gallery.retry')" size="xs" variant="link" @click="load(a.id)" />
              </p>
            </section>
          </template>
        </div>
      </div>
    </div>

    <GalleryLightbox
      v-if="props.photo"
      :items="lightboxItems"
      :total="lightboxTotal"
      :photo="props.photo"
      :title="props.title"
      :settings="props.settings"
      :has-more="!feedOf(lightboxFeed).done"
      :share-url="`${galleryHash(props.shareKey, { album: props.album, photo: props.photo })}`"
      :analytics-label="props.analyticsLabel"
      @go="id => emit('photo', id)"
      @more="load(lightboxFeed)"
      @close="emit('closePhoto')"
    />
  </Teleport>
</template>
