<script setup lang="ts">
/**
 * Terms and conditions / privacy notice. The version accepted at checkout is stored on each
 * booking (`terms_version`). Placeholder text until the owner's legal texts are written.
 */
const route = useRoute()
const { t } = useI18n()
const { data: config } = useBookingConfig()
const page = computed(() => (route.params.page === 'privacy' ? 'privacy' : 'terms'))
if (!['terms', 'privacy'].includes(String(route.params.page))) throw createError({ statusCode: 404, fatal: true })
useSeo({ title: () => `${t(`legal.${page.value}.title`)} · ${t('common.siteName')}`, description: () => t(`legal.${page.value}.intro`) })
</script>

<template>
  <MzContainer size="editorial" class="pt-16 pb-24">
    <article class="flex flex-col gap-6">
      <p class="eyebrow">{{ t('legal.version', { version: config?.terms_version ?? '' }) }}</p>
      <h1 class="text-display-lg">{{ t(`legal.${page}.title`) }}</h1>
      <p class="text-body-lg">{{ t(`legal.${page}.intro`) }}</p>
      <p class="text-muted">{{ t('legal.placeholder') }}</p>
    </article>
  </MzContainer>
</template>
