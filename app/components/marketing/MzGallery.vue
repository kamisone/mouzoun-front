<script setup lang="ts">
/**
 * Image grid with an accessible lightbox: buttons with names, Escape closes (modal), arrow keys
 * move in reading direction (flipped in RTL), counter announced.
 */
export interface GalleryImage { src: string, alt: string, caption?: string }

const props = withDefaults(defineProps<{
  images: GalleryImage[]
  cols?: 2 | 3 | 4
}>(), { cols: 3 })

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
const columns = { 2: 'grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }
</script>

<template>
  <div>
    <ul class="grid gap-3" :class="columns[props.cols]" :aria-label="t('a11y.imageGallery')">
      <li v-for="(image, i) in props.images" :key="image.src">
        <button type="button" class="block w-full rounded-lg" :aria-label="t('gallery.open', { index: i + 1 })" @click="show(i)">
          <MzImage :src="image.src" :alt="image.alt" ratio="1/1" sizes="50vw md:33vw lg:25vw" class="transition-transform duration-200 hover:scale-[1.02] motion-reduce:hover:scale-100" />
        </button>
      </li>
    </ul>

    <UModal v-model:open="open" :title="current?.caption || current?.alt" :description="t('a11y.imageOf', { index: index + 1, total: props.images.length })" :ui="{ content: 'max-w-5xl' }">
      <template #body>
        <div class="flex flex-col gap-3" @keydown="onKey">
          <MzImage v-if="current" :src="current.src" :alt="current.alt" ratio="3/2" fit="contain" sizes="100vw lg:1024px" class="bg-inverted" />
          <div class="flex items-center justify-between gap-2">
            <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" :aria-label="t('common.previous')" :ui="{ leadingIcon: 'rtl:rotate-180' }" @click="step(-1)" />
            <p class="text-sm text-muted tabular-nums" aria-live="polite">{{ index + 1 }} / {{ props.images.length }}</p>
            <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" :aria-label="t('common.next')" :ui="{ leadingIcon: 'rtl:rotate-180' }" @click="step(1)" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
