<script setup lang="ts">
/**
 * Home page, built in the back office (page builder): the published revision, or the draft in
 * the builder's preview. Without a published home page, the static home is shown.
 */
definePageMeta({ headerOverlay: true })
const { t } = useI18n()
const { data, error, preview } = await usePublicPage(() => ({ kind: 'home' }))
const expired = computed(() => !!preview.value && (error.value as { statusCode?: number } | null)?.statusCode === 403)
</script>

<template>
  <div>
    <PageSections v-if="data" :sections="data.sections" :variables="data.variables" :preview="data.preview" />
    <MzEmptyState v-else-if="expired" icon="i-lucide-clock" :title="t('sections.previewExpired')" class="py-40" />
    <MzStaticHome v-else />
  </div>
</template>
