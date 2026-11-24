<script setup lang="ts">
import type { GalleryPhoto, Json } from '~/utils/page-types'
import { srcsetOf } from '~/utils/page-builder'

/**
 * One photo full screen on black: fitted to the screen (largest variants through srcset), caption
 * and "12 / 48" at the bottom, thumbnails on larger screens. Arrows, keyboard (← → mirrored in
 * Arabic, Escape), swipe left/right, swipe down to close, pinch or double-tap to zoom and drag to
 * pan. The previous and next photos are preloaded. Videos play inline with their controls.
 */
const props = defineProps<{
  items: GalleryPhoto[]
  /** Photos in the list walked through (the album, or the whole set). */
  total: number
  photo: string
  title: string
  settings: Json
  hasMore: boolean
  /** Hash of this photo (`#gallery-…/photo-…`). */
  shareUrl: string
  analyticsLabel: string
}>()
const emit = defineEmits<{ go: [id: string], more: [], close: [] }>()
const { t } = useI18n()
/** Native `sizes` (pre-generated variants, not @nuxt/image). */
const FULL_WIDTH = '100vw' // lint-tokens-ignore
const { track } = useAnalytics()
const toast = useToast()
const dir = useTextDirection({ selector: 'html' })

const index = computed(() => props.items.findIndex(i => i.media.id === props.photo))
const current = computed(() => props.items[index.value])
const position = computed(() => index.value + 1)
const canPrev = computed(() => index.value > 0)
const canNext = computed(() => index.value >= 0 && (index.value < props.items.length - 1 || props.hasMore))

function go(delta: number) {
  if (index.value < 0) return
  const target = index.value + delta
  if (target < 0) return
  const next = props.items[target]
  if (next) emit('go', next.media.id)
  else if (props.hasMore) {
    pendingNext = true
    emit('more')
  }
}
/** Pressed "next" at the end of what is loaded: move on once the next page arrives. */
let pendingNext = false
watch(() => props.items.length, () => {
  if (!pendingNext) return
  pendingNext = false
  go(1)
})

// ---- Zoom and gestures ------------------------------------------------------------------------
const scale = ref(1)
const offset = reactive({ x: 0, y: 0 })
const drag = reactive({ x: 0, y: 0, active: false })
const pointers = new Map<number, { x: number, y: number }>()
let start = { x: 0, y: 0, distance: 0, scale: 1, ox: 0, oy: 0, time: 0 }
let lastTap = 0

function resetZoom() {
  scale.value = 1
  offset.x = 0
  offset.y = 0
}
watch(() => props.photo, () => {
  resetZoom()
  drag.x = 0
  drag.y = 0
})

const distance = () => {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
const stage = useTemplateRef<HTMLElement>('stage')
/** Keeps a zoomed photo from being dragged out of the screen. */
function clampOffset() {
  const box = stage.value?.getBoundingClientRect()
  if (!box) return
  const maxX = (box.width * (scale.value - 1)) / 2
  const maxY = (box.height * (scale.value - 1)) / 2
  offset.x = Math.min(maxX, Math.max(-maxX, offset.x))
  offset.y = Math.min(maxY, Math.max(-maxY, offset.y))
}
/** Zooms to `to`, keeping the point under (clientX, clientY) where it is. */
function zoomAt(to: number, clientX: number, clientY: number) {
  const box = stage.value?.getBoundingClientRect()
  if (!box) return
  const px = clientX - (box.left + box.width / 2)
  const py = clientY - (box.top + box.height / 2)
  // Point p shows at p·s + o: keep it fixed when s changes.
  const from = scale.value
  offset.x = px - ((px - offset.x) / from) * to
  offset.y = py - ((py - offset.y) / from) * to
  scale.value = to
  if (to <= 1) resetZoom()
  else clampOffset()
}

function onDown(e: PointerEvent) {
  if (current.value?.media.kind === 'video') return
  // Buttons on the stage (arrows) keep their own clicks: capturing here would swallow them.
  if ((e.target as HTMLElement | null)?.closest('button, a, video')) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  start = { x: e.clientX, y: e.clientY, distance: distance(), scale: scale.value, ox: offset.x, oy: offset.y, time: Date.now() }
  drag.active = true
}
function onMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2 && start.distance) {
    scale.value = Math.min(4, Math.max(1, start.scale * (distance() / start.distance)))
    clampOffset()
    return
  }
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  if (scale.value > 1) {
    offset.x = start.ox + dx
    offset.y = start.oy + dy
    clampOffset()
  }
  else {
    drag.x = dx
    drag.y = Math.max(0, dy)
  }
}
function onUp(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.delete(e.pointerId)
  if (pointers.size > 0) {
    // Pinch ended with one finger left: continue as a pan from here.
    const [rest] = [...pointers.values()]
    start = { ...start, x: rest!.x, y: rest!.y, distance: 0, ox: offset.x, oy: offset.y }
    return
  }
  drag.active = false
  if (scale.value <= 1.02) resetZoom()
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  const quick = Date.now() - start.time < 300 && Math.hypot(dx, dy) < 10
  if (quick) {
    const now = Date.now()
    if (now - lastTap < 300) {
      // Double tap (or double click): zoom in where tapped, or back out.
      if (scale.value > 1) resetZoom()
      else zoomAt(2.5, e.clientX, e.clientY)
      lastTap = 0
    }
    else lastTap = now
  }
  else if (scale.value === 1) {
    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) emit('close')
    else if (Math.abs(dx) > 60) {
      // Swipe towards the start of the line: next photo (mirrored in Arabic).
      const forward = dir.value === 'rtl' ? dx > 0 : dx < 0
      go(forward ? 1 : -1)
    }
  }
  drag.x = 0
  drag.y = 0
}
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  e.preventDefault()
  zoomAt(Math.min(4, Math.max(1, scale.value - e.deltaY * 0.01)), e.clientX, e.clientY)
}
const transform = computed(() => {
  if (scale.value > 1) return `translate(${offset.x}px, ${offset.y}px) scale(${scale.value})`
  return `translate(${drag.x}px, ${drag.y}px)`
})

// ---- Keyboard, focus, preloading ----------------------------------------------------------------
const root = useTemplateRef<HTMLElement>('root')
function onKey(e: KeyboardEvent) {
  const next = dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  const prev = dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  if (e.key === next) {
    e.preventDefault()
    go(1)
  }
  else if (e.key === prev) {
    e.preventDefault()
    go(-1)
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
  else if (e.key === 'Tab' && root.value) trapFocus(root.value, e)
}

const preloaded = new Set<string>()
function preload(i: number) {
  const m = props.items[i]?.media
  if (!m || m.kind !== 'image' || preloaded.has(m.id) || import.meta.server) return
  preloaded.add(m.id)
  const img = new Image()
  img.sizes = '100vw'
  img.srcset = srcsetOf(m) ?? ''
  img.src = m.url
}
watch([index, () => props.items.length], ([i]) => {
  if (i < 0) return
  preload(i + 1)
  preload(i - 1)
  if (i >= props.items.length - 3 && props.hasMore) emit('more')
}, { immediate: true })
watch(() => props.photo, id => track('gallery_photo_view', { section: props.analyticsLabel, media_id: id }), { immediate: true })

/** Thumbnails: keep the current one centred in its strip (scrolls the strip only, never the page). */
const thumbs = useTemplateRef<HTMLElement>('thumbs')
async function centreThumb(smooth = true) {
  await nextTick()
  const list = thumbs.value
  const el = list?.querySelector<HTMLElement>('[aria-current="true"]')
  if (!list || !el) return
  const left = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2
  list.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
}
watch(index, () => centreThumb())

const download = computed(() => {
  const m = current.value?.media
  if (!m) return null
  return m.srcset.length ? m.srcset[m.srcset.length - 1]!.url : m.url
})
async function share() {
  track('gallery_share', { section: props.analyticsLabel, media_id: props.photo })
  const url = `${location.origin}${location.pathname}${location.search}${props.shareUrl}`
  if (await shareLink({ title: props.title, text: current.value?.caption ?? undefined, url }) === 'copied') toast.add({ title: t('sections.gallery.linkCopied'), icon: 'i-lucide-link' })
}

let previous: HTMLElement | null = null
onMounted(() => {
  previous = document.activeElement as HTMLElement | null
  root.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  void centreThumb(false)
})
onBeforeUnmount(() => previous?.focus?.())
</script>

<template>
  <div
    ref="root"
    role="dialog"
    aria-modal="true"
    :aria-label="t('sections.gallery.lightbox', { title: props.title })"
    tabindex="-1"
    class="mz-lightbox dark fixed inset-0 z-(--z-toast) flex select-none flex-col outline-none"
    data-testid="gallery-lightbox"
    @keydown="onKey"
  >
    <div class="flex shrink-0 items-center justify-end gap-2 p-3">
      <UButton
        v-if="props.settings.allow_download && download && current?.media.kind === 'image'"
        :to="download"
        target="_blank"
        download
        icon="i-lucide-download"
        color="neutral"
        variant="ghost"
        class="mz-lightbox-control"
        :aria-label="t('sections.gallery.download')"
      />
      <UButton v-if="props.settings.allow_share !== false" icon="i-lucide-share-2" color="neutral" variant="ghost" class="mz-lightbox-control" :aria-label="t('sections.gallery.share')" @click="share" />
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" class="mz-lightbox-control" :aria-label="t('sections.gallery.closePhoto')" data-autofocus data-testid="lightbox-close" @click="emit('close')" />
    </div>

    <div
      ref="stage"
      class="relative min-h-0 flex-1 touch-none overflow-hidden"
      :class="scale > 1 ? (drag.active ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'"
      data-testid="lightbox-stage"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @wheel="onWheel"
    >
      <div
        class="absolute inset-0 flex items-center justify-center p-2 md:px-24"
        :class="!drag.active && 'transition-transform duration-200'"
        :style="{ transform, opacity: drag.y ? Math.max(0.3, 1 - drag.y / 400) : 1 }"
      >
        <template v-if="current">
          <video
            v-if="current.media.kind === 'video'"
            :key="current.media.id"
            :src="current.media.url"
            controls
            playsinline
            preload="metadata"
            :autoplay="!!props.settings.autoplay_videos"
            :muted="!!props.settings.autoplay_videos"
            class="max-h-full max-w-full"
          />
          <img
            v-else
            :key="current.media.id"
            :src="current.media.url"
            :srcset="srcsetOf(current.media)"
            :sizes="FULL_WIDTH"
            :alt="current.media.alt ?? ''"
            :width="current.media.width ?? undefined"
            :height="current.media.height ?? undefined"
            class="max-h-full max-w-full object-contain"
            draggable="false"
            data-testid="lightbox-image"
          >
        </template>
        <UIcon v-else name="i-lucide-loader-circle" class="size-8 animate-spin" :aria-label="t('common.loading')" />
      </div>
      <UButton v-if="canPrev" icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xl" class="mz-lightbox-control absolute start-4 top-1/2 z-(--z-raised) hidden -translate-y-1/2 md:flex rtl:rotate-180" :aria-label="t('common.previous')" data-testid="lightbox-prev" @click.stop="go(-1)" />
      <UButton v-if="canNext" icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xl" class="mz-lightbox-control absolute end-4 top-1/2 z-(--z-raised) hidden -translate-y-1/2 md:flex rtl:rotate-180" :aria-label="t('common.next')" data-testid="lightbox-next" @click.stop="go(1)" />
    </div>

    <div class="shrink-0 px-4 pb-4 pt-2 text-center">
      <p v-if="current?.caption" class="mx-auto max-w-2xl text-small">{{ current.caption }}</p>
      <p class="mz-lightbox-muted mt-1 text-caption tabular-nums" aria-hidden="true" data-testid="lightbox-counter">
        <bdi>{{ position }} / {{ props.total }}</bdi>
      </p>
      <p class="sr-only" aria-live="polite">{{ t('sections.gallery.position', { n: position, total: props.total }) }}</p>
      <ul ref="thumbs" class="relative mx-auto mt-3 hidden w-fit max-w-full gap-2 overflow-x-auto p-1 md:flex lg:max-w-4xl [scrollbar-width:none]" data-testid="lightbox-thumbs">
        <li v-for="(p, i) in props.items" :key="p.media.id" class="shrink-0">
          <button
            type="button"
            class="block size-14 overflow-hidden rounded-xs outline-offset-2 transition-opacity"
            :class="i === index ? 'opacity-100 ring-2 ring-primary' : 'opacity-50 hover:opacity-80'"
            :aria-current="i === index ? 'true' : undefined"
            :aria-label="t('sections.gallery.position', { n: i + 1, total: props.total })"
            @click="emit('go', p.media.id)"
          >
            <img :src="p.media.srcset[0]?.url ?? p.media.url" alt="" loading="lazy" class="size-full object-cover" draggable="false">
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
