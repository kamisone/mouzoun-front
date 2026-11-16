<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Partner, label or press logos, in a row or a carousel; greyscale until hovered. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { text, media } = useSectionContext(() => props.section)
const logos = computed(() => props.section.items.filter(i => media(i.settings.media_id)))
const logoSizes = '160px' // lint-tokens-ignore (native <img> sizes, not @nuxt/image)
const gray = computed(() => props.section.settings.grayscale !== false && 'grayscale transition hover:grayscale-0')
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <MzCarousel v-if="props.section.settings.layout === 'carousel'" :count="logos.length" :label="text(props.section.content.title) || t('sections.logos')" slide-class="basis-1/3 md:basis-1/5">
      <template #default="{ index: i }">
        <component :is="logos[i]!.settings.link?.href ? 'a' : 'div'" :href="logos[i]!.settings.link?.href" class="block" :class="gray">
          <MzMedia :media="media(logos[i]!.settings.media_id)!" :alt="text(logos[i]!.content.name)" ratio="3/2" fit="contain" :rounded="false" :sizes="logoSizes" />
        </component>
      </template>
    </MzCarousel>
    <ul v-else class="flex flex-wrap items-center justify-center gap-12">
      <li v-for="logo in logos" :key="logo.id" class="w-32" :class="gray">
        <component :is="logo.settings.link?.href ? 'a' : 'div'" :href="logo.settings.link?.href" :target="logo.settings.link?.new_tab ? '_blank' : undefined" class="block">
          <MzMedia :media="media(logo.settings.media_id)!" :alt="text(logo.content.name)" ratio="3/2" fit="contain" :rounded="false" :sizes="logoSizes" />
        </component>
      </li>
    </ul>
  </MzSectionContainer>
</template>
