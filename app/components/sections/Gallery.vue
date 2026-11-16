<script setup lang="ts">
import type { MediaView, RenderedSection } from '~/utils/page-types'

/** Photos (a gallery or a hand-picked list): grid, masonry or carousel, optional full-screen view. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { text, media } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const photos = computed(() => ((props.section.data.photos ?? []) as string[]).map(id => media(id)).filter((m): m is MediaView => !!m))
const open = ref(false)
const current = ref(0)
const dir = useTextDirection({ selector: 'html' })
function show(i: number) {
  if (!s.value.lightbox) return
  current.value = i
  open.value = true
}
function step(delta: number) {
  const n = photos.value.length
  current.value = (current.value + delta + n) % n
}
function onKey(e: KeyboardEvent) {
  if (e.key === (dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) step(1)
  if (e.key === (dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) step(-1)
}
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <MzCarousel v-if="s.layout === 'carousel'" :count="photos.length" :label="text(props.section.content.title) || t('sections.gallery.title')">
      <template #default="{ index: i }">
        <button type="button" class="block w-full" :disabled="!s.lightbox" :aria-label="t('sections.gallery.open', { alt: photos[i]!.alt ?? '' })" @click="show(i)">
          <MzMedia :media="photos[i]!" ratio="4/5" sizes="(min-width: 1024px) 33vw, 80vw" />
        </button>
      </template>
    </MzCarousel>
    <ul v-else :class="s.layout === 'masonry' ? 'columns-2 gap-4 lg:columns-3 [&>li]:mb-4' : 'grid grid-cols-2 gap-4 lg:grid-cols-3'">
      <li v-for="(photo, i) in photos" :key="photo.id" class="break-inside-avoid">
        <button type="button" class="block w-full cursor-zoom-in disabled:cursor-default" :disabled="!s.lightbox" :aria-label="t('sections.gallery.open', { alt: photo.alt ?? '' })" @click="show(i)">
          <MzMedia :media="photo" :ratio="s.layout === 'masonry' ? undefined : '1/1'" sizes="(min-width: 1024px) 33vw, 50vw" />
        </button>
      </li>
    </ul>
    <UModal v-model:open="open" fullscreen :title="t('sections.gallery.title')" :description="t('sections.gallery.position', { n: current + 1, total: photos.length })">
      <template #body>
        <div class="flex h-full flex-col items-center justify-center gap-6" @keydown="onKey">
          <img v-if="photos[current]" :src="photos[current]!.url" :alt="photos[current]!.alt ?? ''" class="max-h-[75vh] w-auto object-contain">
          <p v-if="photos[current]?.alt" class="text-small text-muted">{{ photos[current]!.alt }}</p>
          <div class="flex gap-4">
            <UButton icon="i-lucide-arrow-left" class="rtl:rotate-180" color="neutral" variant="outline" :aria-label="t('common.previous')" @click="step(-1)" />
            <span class="self-center text-small" aria-live="polite">{{ current + 1 }} / {{ photos.length }}</span>
            <UButton icon="i-lucide-arrow-right" class="rtl:rotate-180" color="neutral" variant="outline" :aria-label="t('common.next')" @click="step(1)" />
          </div>
        </div>
      </template>
    </UModal>
  </MzSectionContainer>
</template>
