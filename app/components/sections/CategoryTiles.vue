<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

interface Category { id: string, name: string, slug: string, description: string | null, icon: string | null, cover_media_id: string | null, href: string }

/** Product categories: chips, or photo tiles. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { media } = useSectionContext(() => props.section)
const categories = computed(() => (props.section.data.categories ?? []) as Category[])
const icons = computed(() => props.section.settings.show_icons !== false)
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <ul v-if="props.section.settings.layout === 'chips'" class="flex flex-wrap gap-3">
      <li v-for="cat in categories" :key="cat.id">
        <UButton :to="cat.href" :label="cat.name" :icon="icons && cat.icon ? cat.icon : undefined" color="neutral" variant="outline" />
      </li>
    </ul>
    <ul v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="cat in categories" :key="cat.id" class="group relative">
        <MzMedia v-if="media(cat.cover_media_id)" :media="media(cat.cover_media_id)!" decorative ratio="3/2" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <div class="mt-4 flex items-center gap-3">
          <UIcon v-if="icons && cat.icon" :name="cat.icon" class="size-6 text-primary" aria-hidden="true" />
          <NuxtLink :to="cat.href" class="text-h3 after:absolute after:inset-0 after:content-['']">{{ cat.name }}</NuxtLink>
        </div>
        <p v-if="cat.description" class="mt-2 text-small text-muted">{{ cat.description }}</p>
      </li>
    </ul>
  </MzSectionContainer>
</template>
