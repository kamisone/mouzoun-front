<script setup lang="ts">
import type { PageSummary } from '~/utils/page-types'

/** Site pages (home, about, landing pages, posts): open one in the page builder, or create one. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.builder.pagesTitle' })
const { t } = useI18n()
const api = useAdminApi()
const { data } = await useAsyncData('admin-pages', () => api.pages.list())
const creating = ref(false)
const form = reactive({ page_type: 'page', title: '', slug: '' })
const busy = ref(false)
const error = ref('')
const types = ['page', 'landing', 'post', 'legal', 'home'].map(v => ({ label: t(`admin.builder.pageTypes.${v}`), value: v }))

watch(() => form.title, (title) => {
  form.slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
})
async function create() {
  busy.value = true
  error.value = ''
  try {
    const { id } = await api.pages.create({ page_type: form.page_type, translations: { fr: { title: form.title, slug: form.slug } } })
    await navigateTo(`/admin/pages/${id}/builder`)
  }
  catch {
    error.value = t('admin.builder.createFailed')
  }
  finally {
    busy.value = false
  }
}
function status(p: PageSummary) {
  if (p.scheduled_at) return { label: t('admin.builder.status.scheduled'), color: 'info' as const }
  if (!p.published_revision) return { label: t('admin.builder.status.draft'), color: 'neutral' as const }
  if (p.has_unpublished_changes) return { label: t('admin.builder.status.changes'), color: 'warning' as const }
  return { label: t('admin.builder.status.published'), color: 'success' as const }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="t('admin.builder.pagesTitle')" :description="t('admin.builder.pagesIntro')">
      <template #actions>
        <UButton :label="t('admin.builder.newPage')" icon="i-lucide-plus" @click="creating = true" />
      </template>
    </MzPageHeader>
    <ul class="divide-y divide-default rounded-sm border border-default">
      <li v-for="p in data?.pages ?? []" :key="p.id" class="flex items-center gap-4 p-4">
        <UIcon :name="p.page_type === 'home' ? 'i-lucide-house' : 'i-lucide-file-text'" class="size-5 text-toned" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ p.title ?? p.id }}</p>
          <p class="text-small text-muted">{{ t(`admin.builder.pageTypes.${p.page_type}`) }} · /{{ p.page_type === 'home' ? '' : p.slug }}</p>
        </div>
        <UBadge v-bind="status(p)" variant="subtle" />
        <UButton :to="`/admin/pages/${p.id}/builder`" :label="t('admin.builder.open')" icon="i-lucide-layout-template" color="neutral" variant="outline" :data-testid="`open-builder-${p.page_type}`" />
      </li>
    </ul>
    <UModal v-model:open="creating" :title="t('admin.builder.newPage')">
      <template #body>
        <form id="new-page" class="flex flex-col gap-4" @submit.prevent="create">
          <UFormField :label="t('admin.builder.pageType')"><USelect v-model="form.page_type" :items="types" class="w-full" /></UFormField>
          <UFormField :label="t('admin.builder.pageTitle')" required><UInput v-model="form.title" required class="w-full" /></UFormField>
          <UFormField :label="t('admin.builder.slug')" required><UInput v-model="form.slug" required class="w-full" /></UFormField>
          <p v-if="error" class="text-small text-error" role="alert">{{ error }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="creating = false" />
          <UButton type="submit" form="new-page" :label="t('common.save')" :loading="busy" />
        </div>
      </template>
    </UModal>
  </div>
</template>
