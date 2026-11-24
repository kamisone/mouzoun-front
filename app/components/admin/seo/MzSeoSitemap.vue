<script setup lang="ts">
/**
 * Plan du site: the sitemap address (copy, open), URLs per file and per language, last build,
 * "Reconstruire", the robots.txt this site serves, and where to submit the sitemap.
 */
const props = defineProps<{ readOnly: boolean }>()
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()
const { date } = useDate()
const { data, refresh, pending } = await useAsyncData('seo-sitemap-status', () => admin.seo.sitemapStatus())
const robots = ref('')
onMounted(async () => {
  robots.value = await $fetch<string>('/robots.txt', { responseType: 'text' }).catch(() => '')
})
const total = computed(() => (data.value?.files ?? []).reduce((n, f) => n + f.count, 0))
const locales = computed(() => [...new Set((data.value?.files ?? []).flatMap(f => Object.keys(f.per_locale)))].sort())
async function copy() {
  await navigator.clipboard?.writeText(data.value?.sitemap_url ?? '').catch(() => {})
  toast.add({ title: t('admin.seo.sitemap.copied'), color: 'success' })
}
const rebuilding = ref(false)
async function rebuild() {
  rebuilding.value = true
  try {
    await admin.seo.rebuildSitemap()
    await refresh()
    toast.add({ title: t('admin.seo.sitemap.rebuilt'), color: 'success' })
  }
  catch {
    toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
  finally {
    rebuilding.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="seo-sitemap">
    <section class="flex flex-col gap-3 rounded-md border border-default p-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-small" dir="ltr">{{ data?.sitemap_url }}</span>
        <UButton size="xs" icon="i-lucide-copy" color="neutral" variant="outline" :label="t('admin.seo.sitemap.copy')" @click="copy" />
        <UButton size="xs" icon="i-lucide-external-link" color="neutral" variant="outline" :label="t('admin.seo.sitemap.open')" :to="data?.sitemap_url" target="_blank" />
        <UButton v-if="!props.readOnly" size="xs" icon="i-lucide-refresh-cw" class="ms-auto" :label="t('admin.seo.sitemap.rebuild')" :loading="rebuilding" @click="rebuild" />
      </div>
      <p class="text-small text-muted">
        {{ t('admin.seo.sitemap.summary', { n: total }) }}
        <template v-if="data?.built_at"> · {{ t('admin.seo.sitemap.builtAt', { date: date(data.built_at) }) }}</template>
      </p>
      <table class="w-full text-small" :aria-busy="pending">
        <thead>
          <tr class="text-start">
            <th class="p-2 text-start font-medium">{{ t('admin.seo.sitemap.file') }}</th>
            <th class="p-2 text-end font-medium">{{ t('admin.seo.sitemap.urls') }}</th>
            <th v-for="l in locales" :key="l" class="p-2 text-end font-medium">{{ l.toUpperCase() }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in data?.files ?? []" :key="f.name" class="border-t border-default">
            <td class="p-2"><a :href="f.url" target="_blank" rel="noopener" class="font-mono underline" dir="ltr">{{ f.name }}</a></td>
            <td class="p-2 text-end tabular-nums">{{ f.count }}</td>
            <td v-for="l in locales" :key="l" class="p-2 text-end tabular-nums">{{ f.per_locale[l] ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section class="flex flex-col gap-2 rounded-md border border-default p-4">
      <h2 class="font-medium">robots.txt</h2>
      <pre class="overflow-x-auto rounded-sm bg-elevated p-3 text-caption" dir="ltr" data-testid="robots-preview">{{ robots }}</pre>
      <p class="text-small text-muted">{{ t('admin.seo.sitemap.robotsHelp') }}</p>
    </section>
    <section class="flex flex-col gap-1 rounded-md border border-default p-4 text-small">
      <h2 class="font-medium">{{ t('admin.seo.sitemap.submitTitle') }}</h2>
      <p class="text-muted">{{ t('admin.seo.sitemap.submitGoogle') }} <span dir="ltr">https://search.google.com/search-console/sitemaps</span></p>
      <p class="text-muted">{{ t('admin.seo.sitemap.submitBing') }} <span dir="ltr">https://www.bing.com/webmasters/sitemaps</span></p>
    </section>
  </div>
</template>
