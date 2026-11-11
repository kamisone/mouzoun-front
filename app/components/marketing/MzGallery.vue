<script setup lang="ts">
/**
 * Photo gallery. Mobile: horizontal scroll with snap (peek of the next photo). Desktop: an
 * editorial row. Each photo opens an accessible lightbox (Escape closes, arrows follow the
 * reading direction, position announced).
 */
export interface GalleryImage { src: string, alt: string, caption?: string, lqip?: string, srcset?: string }

const props = withDefaults(defineProps<{
  images: GalleryImage[]
  ratio?: '4/5' | '3/2' | '1/1'
}>(), { ratio: '4/5' })

const { t } = useI18n()
const dir = useTextDirection({ selector: 'html' })
const open = ref(false)
const index = ref(0)
const current = computed(() => props.images[index.value])

function show(i: number) {
  index.value = i
  open.value = true
}
function step(delta: number) {
  const n = props.images.length
  index.value = (index.value + delta + n) % n
}
function onKey(e: KeyboardEvent) {
  const forward = dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  const backward = dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  if (e.key === forward) step(1)
  if (e.key === backward) step(-1)
}
</script>

<template>
  <div>
    <ul
      class="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:snap-none lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0"
      :aria-label="t('a11y.imageGallery')"
    >
      <li v-for="(image, i) in props.images" :key="image.src" class="w-[72%] shrink-0 snap-start sm:w-[45%] lg:w-auto" :class="i % 2 === 1 && 'lg:translate-y-12'">
        <button type="button" class="group block w-full" :aria-label="t('gallery.open', { index: i + 1 })" @click="show(i)">
          <MzImage :src="image.src" :srcset="image.srcset" :alt="image.alt" :lqip="image.lqip" :ratio="props.ratio" zoom sizes="xs:72vw sm:45vw lg:20vw" />
        </button>
      </li>
    </ul>

    <UModal v-model:open="open" :title="current?.caption || current?.alt" :description="t('a11y.imageOf', { index: index + 1, total: props.images.length })" :ui="{ content: 'max-w-5xl' }">
      <template #body>
        <div class="flex flex-col gap-4" @keydown="onKey">
          <MzImage v-if="current" :src="current.src" :srcset="current.srcset" :alt="current.alt" :lqip="current.lqip" ratio="3/2" fit="contain" sizes="xs:100vw lg:1024px" class="bg-inverted" />
          <div class="flex items-center justify-between gap-2">
            <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :aria-label="t('common.previous')" :ui="{ leadingIcon: 'rtl:rotate-180' }" @click="step(-1)" />
            <p class="text-small text-muted tabular-nums" aria-live="polite">{{ index + 1 }} / {{ props.images.length }}</p>
            <UButton icon="i-lucide-arrow-right" color="neutral" variant="ghost" :aria-label="t('common.next')" :ui="{ leadingIcon: 'rtl:rotate-180' }" @click="step(1)" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
