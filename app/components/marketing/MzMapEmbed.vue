<script setup lang="ts">
/**
 * Map of a place. Privacy first: nothing is loaded from a third party until the visitor asks
 * (OpenStreetMap embed), and a plain link to Google Maps always works.
 */
const props = withDefaults(defineProps<{
  lat: number
  lng: number
  zoom?: number
  title?: string
  ratio?: string
}>(), { zoom: 11, title: undefined, ratio: '16/9' })

const { t } = useI18n()
const loaded = ref(false)
const span = computed(() => 0.6 / 2 ** (props.zoom - 9))
const embedUrl = computed(() => {
  const [w, s, e, n] = [props.lng - span.value, props.lat - span.value / 2, props.lng + span.value, props.lat + span.value / 2]
  return `https://www.openstreetmap.org/export/embed.html?bbox=${w},${s},${e},${n}&layer=mapnik&marker=${props.lat},${props.lng}`
})
const mapsUrl = computed(() => `https://www.google.com/maps?q=${props.lat},${props.lng}`)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative overflow-hidden rounded-lg bg-elevated ring ring-default" :style="{ aspectRatio: props.ratio }">
      <iframe
        v-if="loaded"
        :src="embedUrl"
        :title="props.title ?? t('map.title')"
        class="absolute inset-0 size-full border-0"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <UIcon name="i-lucide-map" class="size-8 text-primary" aria-hidden="true" />
        <p class="max-w-sm text-sm text-muted">{{ t('map.consent') }}</p>
        <UButton :label="t('map.load')" icon="i-lucide-map-pin" variant="soft" @click="loaded = true" />
      </div>
    </div>
    <ULink :to="mapsUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
      <UIcon name="i-lucide-external-link" class="size-4" aria-hidden="true" />
      {{ t('common.openInMaps') }}
      <span class="sr-only">{{ t('a11y.externalLink') }}</span>
    </ULink>
  </div>
</template>
