<script setup lang="ts">
import type { PageSummary } from '~/utils/page-types'

/**
 * Site pages (home, about, landing pages, posts): open one in the page builder, create one, or fix
 * the type chosen at creation ("Change type", publishers only; never the home page). Draft only:
 * the live page takes the new type at the next publication.
 */
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
// ---- Change type ---------------------------------------------------------------------------
const { user } = useAuth()
const canPublish = computed(() => user.value?.permissions.includes('content.publish') ?? false)
const CHANGEABLE = ['page', 'landing', 'post', 'legal'] as const
const typeItems = CHANGEABLE.map(v => ({ label: t(`admin.builder.pageTypes.${v}`), value: v as string }))
const retyping = ref<PageSummary | null>(null)
const newType = ref<string>('page')
const typeError = ref('')
const typeBusy = ref(false)
const toast = useToast()
function openChangeType(p: PageSummary) {
  retyping.value = p
  newType.value = p.page_type
  typeError.value = ''
}
function rowActions(p: PageSummary) {
  return [[{ label: t('admin.builder.changeType.action'), icon: 'i-lucide-replace', onSelect: () => openChangeType(p) }]]
}
/** The API's refusal in words: which check failed. */
function typeErrorText(e: unknown) {
  const code = apiErrorCode(e)
  const details = apiErrorDetails<{ tokens?: string[], errors?: unknown[] }>(e) ?? {}
  const k = 'admin.builder.changeType.errors'
  return code === 'french_required'
    ? t(`${k}.french_required`)
    : code === 'unknown_tokens'
      ? t(`${k}.unknown_tokens`, { tokens: (details.tokens ?? []).map(tk => `{{${tk}}}`).join(', ') })
      : code === 'invalid_sections'
        ? t(`${k}.invalid_sections`, { n: details.errors?.length ?? 0 })
        : code === 'home_type_locked'
          ? t(`${k}.home_type_locked`)
          : t(`${k}.failed`)
}
async function changeType() {
  const p = retyping.value
  if (!p) return
  if (newType.value === p.page_type) {
    retyping.value = null
    return
  }
  typeBusy.value = true
  typeError.value = ''
  try {
    const { page_type } = await api.pages.changeType(p.id, newType.value)
    retyping.value = null
    toast.add({
      title: t('admin.builder.changeType.done', { type: t(`admin.builder.pageTypes.${page_type}`) }),
      description: p.published_revision ? t('admin.builder.changeType.publishToApply') : undefined,
      color: 'success',
    })
    await refreshNuxtData('admin-pages')
  }
  catch (e) {
    typeError.value = typeErrorText(e)
  }
  finally {
    typeBusy.value = false
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
        <UDropdownMenu v-if="canPublish && p.page_type !== 'home'" :items="rowActions(p)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" :aria-label="`${t('admin.builder.pageActions')} · ${p.title ?? p.slug}`" :data-testid="`page-actions-${p.id}`" />
        </UDropdownMenu>
        <span v-else-if="canPublish" class="w-8" aria-hidden="true" />
      </li>
    </ul>
    <UModal :open="!!retyping" :title="t('admin.builder.changeType.title', { title: retyping?.title ?? retyping?.slug ?? '' })" :description="t('admin.builder.changeType.intro')" @update:open="v => { if (!v) retyping = null }">
      <template #body>
        <form id="change-type" class="flex flex-col gap-4" data-testid="change-type-form" @submit.prevent="changeType">
          <URadioGroup v-model="newType" :items="typeItems" :legend="t('admin.builder.pageType')" />
          <UAlert v-if="retyping?.published_revision" color="info" variant="subtle" icon="i-lucide-info" :description="t('admin.builder.changeType.live')" />
          <p v-if="newType === 'legal' && retyping?.page_type !== 'legal'" class="text-small text-muted">{{ t('admin.builder.changeType.legalChecks') }}</p>
          <p v-if="typeError" class="text-small text-error" role="alert" data-testid="change-type-error">{{ typeError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="retyping = null" />
          <UButton type="submit" form="change-type" :label="t('admin.builder.changeType.save')" :loading="typeBusy" :disabled="newType === retyping?.page_type" data-testid="change-type-save" />
        </div>
      </template>
    </UModal>
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
