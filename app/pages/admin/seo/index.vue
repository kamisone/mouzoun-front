<script setup lang="ts">
/**
 * Admin › SEO: redirects (automatic and manual), the 404 log with suggestions, the sitemap and
 * robots.txt, and an address tester available on every tab. Editing needs `seo.manage`;
 * `content.read` sees everything read-only. The tab lives in the URL (`?tab=`).
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.seo.title' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { can } = useShopAdmin()
if (!can('seo.manage') && !can('content.read')) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
const readOnly = computed(() => !can('seo.manage'))
const tabs = computed(() => [
  { value: 'redirects', label: t('admin.seo.tabs.redirects'), icon: 'i-lucide-corner-down-right' },
  { value: 'not-found', label: t('admin.seo.tabs.notFound'), icon: 'i-lucide-circle-help' },
  { value: 'sitemap', label: t('admin.seo.tabs.sitemap'), icon: 'i-lucide-network' },
])
const tab = computed({
  get: () => (['redirects', 'not-found', 'sitemap'].includes(String(route.query.tab)) ? String(route.query.tab) : 'redirects'),
  set: v => router.replace({ query: { tab: v === 'redirects' ? undefined : v } }),
})
// "Créer une redirection" from a 404 row: prefilled form on the redirects tab.
const prefill = ref<{ from_path: string, to_path?: string } | null>(null)
function createFrom(from: string, to?: string) {
  prefill.value = { from_path: from, to_path: to }
  tab.value = 'redirects'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="t('admin.seo.title')" :description="t('admin.seo.intro')" />
    <MzSeoTester />
    <UTabs v-model="tab" :items="tabs" variant="link" :content="false" data-testid="seo-tabs" />
    <MzSeoRedirects v-if="tab === 'redirects'" v-model:prefill="prefill" :read-only="readOnly" />
    <MzSeoNotFound v-else-if="tab === 'not-found'" :read-only="readOnly" @create="createFrom" />
    <MzSeoSitemap v-else :read-only="readOnly" />
  </div>
</template>
