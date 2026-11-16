<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** The latest posts (or one category's). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { media } = useSectionContext(() => props.section)
const posts = computed(() => (props.section.data.posts ?? []) as { id: string, title: string, excerpt: string | null, cover_media_id: string | null, published_at: string, href: string }[])
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <ul class="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
      <li v-for="post in posts" :key="post.id" class="group relative">
        <MzMedia v-if="media(post.cover_media_id)" :media="media(post.cover_media_id)!" decorative ratio="3/2" class="mb-6" sizes="(min-width: 1024px) 33vw, 100vw" />
        <p class="text-caption text-toned"><MzDate :value="post.published_at" /></p>
        <h3 class="mt-2 text-h3"><NuxtLink :to="post.href" class="after:absolute after:inset-0 after:content-['']">{{ post.title }}</NuxtLink></h3>
        <p v-if="post.excerpt" class="mt-2 line-clamp-3 text-muted">{{ post.excerpt }}</p>
        <span class="mt-4 inline-block text-small font-medium text-primary">{{ t('sections.posts.read') }}</span>
      </li>
    </ul>
  </MzSectionContainer>
</template>
