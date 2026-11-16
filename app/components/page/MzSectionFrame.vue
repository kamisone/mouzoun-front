<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/**
 * The outer box of every section: anchor id, device visibility (CSS only: no layout shift),
 * colour scheme (scoped light/dark tokens), vertical space, background photo and dividers.
 * In preview, a click selects the section in the builder.
 */
const props = defineProps<{ section: RenderedSection }>()
const { media, preview } = useSectionContext(() => props.section)
const a = computed(() => props.section.appearance ?? {})

const schemes = {
  light: 'light bg-default',
  dark: 'dark bg-elevated',
  sand: 'light bg-muted',
  night: 'dark bg-default',
  brand: 'dark bg-primary',
} as const
/** Divider fill = the section's own surface (same token as the class above, in its scope). */
const fills = { light: 'text-(--ui-bg)', dark: 'text-(--ui-bg-elevated)', sand: 'text-(--ui-bg-muted)', night: 'text-(--ui-bg)', brand: 'text-(--ui-primary)' } as const
const top = { none: 'pt-0', sm: 'pt-12', md: 'pt-16 lg:pt-24', lg: 'pt-24 lg:pt-32', xl: 'pt-32 lg:pt-40' } as const
const bottom = { none: 'pb-0', sm: 'pb-12', md: 'pb-16 lg:pb-24', lg: 'pb-24 lg:pb-32', xl: 'pb-32 lg:pb-40' } as const
const devices = { all: '', desktop: 'hidden md:block', mobile: 'md:hidden' } as const

const scheme = computed(() => a.value.color_scheme ?? 'light')
const background = computed(() => media(a.value.background_media_id))
const shapes = {
  wave: 'M0 40 C 240 0 480 0 720 20 C 960 40 1200 40 1440 10 L1440 40 Z',
  dunes: 'M0 40 C 180 10 360 4 560 22 C 700 34 820 6 1000 12 C 1180 18 1300 30 1440 20 L1440 40 Z',
  slant: 'M0 40 L1440 0 L1440 40 Z',
} as const

function select(event: MouseEvent) {
  if (!preview || !window.parent || window.parent === window) return
  event.preventDefault()
  window.parent.postMessage({ type: 'mz:select-section', id: props.section.id }, window.location.origin)
}
</script>

<template>
  <section
    :id="props.section.anchor_id ?? undefined"
    :aria-labelledby="props.section.content.title ? `${props.section.id}-title` : undefined"
    :data-section-id="props.section.id"
    :data-section-type="props.section.type"
    :data-analytics="props.section.analytics_label ?? undefined"
    class="relative isolate scroll-mt-24 text-default"
    :class="[schemes[scheme], top[a.padding_top ?? 'lg'], bottom[a.padding_bottom ?? 'lg'], devices[props.section.visible_on], preview && 'cursor-pointer outline-primary/40 hover:outline-2 hover:-outline-offset-2']"
    @click.capture="preview ? select($event) : undefined"
  >
    <svg v-if="a.divider_top && a.divider_top !== 'none'" class="pointer-events-none absolute start-0 bottom-full h-6 w-full lg:h-10" :class="fills[scheme]" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true">
      <path :d="shapes[a.divider_top]" fill="currentColor" />
    </svg>
    <template v-if="background">
      <MzMedia :media="background" fill decorative :rounded="false" class="-z-10" />
      <div class="absolute inset-0 -z-10 bg-default/70" aria-hidden="true" />
    </template>
    <slot />
    <svg v-if="a.divider_bottom && a.divider_bottom !== 'none'" class="pointer-events-none absolute start-0 top-full h-6 w-full rotate-180 lg:h-10" :class="fills[scheme]" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true">
      <path :d="shapes[a.divider_bottom]" fill="currentColor" />
    </svg>
  </section>
</template>
