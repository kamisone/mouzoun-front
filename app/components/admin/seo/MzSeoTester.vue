<script setup lang="ts">
import type { UrlTest } from '~/utils/seo-admin-api'

/** "Tester une adresse": what the site does with a path (normalisation, redirect, content, indexing). */
const { t } = useI18n()
const admin = useAdminApi()
const path = ref('')
const result = ref<UrlTest | null>(null)
const error = ref('')
const loading = ref(false)
async function run() {
  if (!path.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    const input = path.value.trim().replace(/^https?:\/\/[^/]+/, '')
    result.value = await admin.seo.test(input || '/')
  }
  catch {
    error.value = t('admin.seo.tester.failed')
    result.value = null
  }
  finally {
    loading.value = false
  }
}
const editLink = (type: string, id: string | null) => {
  if (!id) return null
  if (type === 'shop_product') return `/admin/shop/products/${id}`
  if (type === 'shop_category') return `/admin/shop/categories/${id}`
  if (type === 'page') return `/admin/pages/${id}/builder`
  return null
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-md border border-default p-4" aria-labelledby="seo-tester" data-testid="seo-tester">
    <h2 id="seo-tester" class="font-medium">{{ t('admin.seo.tester.title') }}</h2>
    <form class="flex flex-wrap gap-2" @submit.prevent="run">
      <UInput v-model="path" :placeholder="t('admin.seo.tester.placeholder')" :aria-label="t('admin.seo.tester.title')" class="min-w-64 flex-1" dir="ltr" data-testid="tester-input" />
      <UButton type="submit" :label="t('admin.seo.tester.run')" icon="i-lucide-search" :loading="loading" />
    </form>
    <p v-if="error" class="text-small text-error" role="alert">{{ error }}</p>
    <dl v-if="result" class="grid gap-x-4 gap-y-2 text-small sm:grid-cols-[12rem_1fr]" data-testid="tester-result" aria-live="polite">
      <dt class="text-muted">{{ t('admin.seo.tester.normalized') }}</dt>
      <dd dir="ltr" class="font-mono">{{ result.normalized }}<span v-if="result.normalization_redirect" class="ms-2 text-warning">{{ t('admin.seo.tester.normalizationRedirect') }}</span></dd>
      <dt class="text-muted">{{ t('admin.seo.tester.redirect') }}</dt>
      <dd>
        <template v-if="result.redirect">
          <span dir="ltr" class="font-mono">{{ result.redirect.status_code }} → {{ result.redirect.to_path }}</span>
          · {{ t(`admin.seo.source.${result.redirect.source}`) }}
          <span v-if="!result.redirect.is_active" class="text-warning"> · {{ t('admin.seo.redirects.inactive') }}</span>
        </template>
        <template v-else>{{ t('admin.seo.tester.none') }}</template>
      </dd>
      <dt class="text-muted">{{ t('admin.seo.tester.content') }}</dt>
      <dd>
        <template v-if="result.content">
          {{ t(`admin.seo.types.${result.content.entity_type}`) }} ({{ result.content.locale.toUpperCase() }})
          <NuxtLink v-if="editLink(result.content.entity_type, result.content.entity_id)" :to="editLink(result.content.entity_type, result.content.entity_id)!" class="ms-2 underline">{{ t('common.edit') }}</NuxtLink>
          <span v-if="!result.content.served" class="ms-2 text-warning">{{ t('admin.seo.tester.notServed') }}</span>
        </template>
        <template v-else>{{ t('admin.seo.tester.noContent') }}</template>
      </dd>
      <template v-if="result.content">
        <dt class="text-muted">{{ t('admin.seo.tester.indexing') }}</dt>
        <dd data-testid="tester-indexing">
          <UBadge v-if="result.content.indexability.status === 'indexable'" color="success" variant="soft" :label="t('admin.seo.tester.indexable')" />
          <template v-else>
            <UBadge color="warning" variant="soft" :label="t('admin.seo.tester.notIndexable')" />
            <span class="ms-2">{{ t(`admin.seo.reasons.${result.content.indexability.reason}`) }}</span>
          </template>
        </dd>
        <dt class="text-muted">{{ t('admin.seo.tester.inSitemap') }}</dt>
        <dd>{{ result.content.in_sitemap ? t('admin.seo.yes') : t('admin.seo.no') }}<span v-if="result.content.canonical_path && result.content.canonical_path !== result.normalized" dir="ltr" class="ms-2 text-muted">({{ t('admin.seo.tester.canonical') }} {{ result.content.canonical_path }})</span></dd>
      </template>
    </dl>
  </section>
</template>
