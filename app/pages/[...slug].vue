<script setup lang="ts">
/**
 * Pages built in the back office (About, landing pages, posts...), by their slug in the current
 * language. A missing page is a 404; an unreachable API a 503 (search engines retry later).
 */
const route = useRoute()
const { t } = useI18n()
const slug = computed(() => ([] as string[]).concat(route.params.slug ?? []).join('/'))
const { data, error, preview } = await usePublicPage(() => ({ kind: 'slug', slug: slug.value }))
if (!data.value) {
  const status = (error.value as { statusCode?: number } | null)?.statusCode
  if (preview.value && status === 403) throw createError({ statusCode: 403, statusMessage: t('sections.previewExpired'), fatal: true })
  throw status === 404 || !error.value
    ? createError({ statusCode: 404, statusMessage: t('error.notFound'), fatal: true })
    : createError({ statusCode: 503, statusMessage: t('error.unavailable'), fatal: true })
}
const startsWithHero = computed(() => ['hero', 'hero_slider'].includes(data.value?.sections[0]?.type ?? ''))
</script>

<template>
  <div :class="!startsWithHero && 'pt-24'">
    <PageSections v-if="data" :sections="data.sections" :variables="data.variables" :preview="data.preview" />
  </div>
</template>
