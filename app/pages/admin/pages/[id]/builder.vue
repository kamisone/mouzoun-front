<script setup lang="ts">
import type { BlockDraft } from '~/utils/page-types'

/**
 * Page builder: sections (left), live preview of the draft (centre, desktop / tablet / mobile, any
 * language) and the selected section's form (right). Autosaves 2 s after the last change;
 * publishing (now or scheduled) needs `content.publish`.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.builder.title' })
const { t, locales } = useI18n()
const route = useRoute()
const api = useAdminApi()
const pageId = String(route.params.id)
const builder = useBuilder(pageId)
const { tree, blocks, selected, selectedBlock, saving, dirty, conflict, errors, canPublish, lastSaved } = builder
await builder.load()

const device = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const previewLocale = ref<string>('fr')
provide('builder-locale', previewLocale)
const token = ref<string | null>(null)
const revisionPreview = ref<string | null>(null)
const addOpen = ref(false)
const addPosition = ref(0)
const publishOpen = ref(false)
const historyOpen = ref(false)
const sharedOpen = ref(false)
const sharedId = ref<string | null>(null)
const iframe = useTemplateRef<HTMLIFrameElement>('frame')
watch(iframe, el => (builder.preview.value = el ?? null), { immediate: true })

async function newToken() {
  token.value = (await api.pages.previewToken(pageId)).token
}
await newToken()
// Tokens live 30 minutes: renew before they expire.
useIntervalFn(newToken, 25 * 60 * 1000)

const pagePath = computed(() => {
  const p = tree.value?.page
  if (!p) return '/'
  const prefix = previewLocale.value === 'fr' ? '' : `/${previewLocale.value}`
  if (p.page_type === 'home') return prefix || '/'
  return `${prefix}/${p.translations[previewLocale.value]?.slug ?? p.translations.fr?.slug ?? ''}`
})
const src = computed(() => (token.value ? `${pagePath.value}?preview=${token.value}${revisionPreview.value ? `&revision=${revisionPreview.value}` : ''}` : 'about:blank'))
const widths = { desktop: 'w-full', tablet: 'w-[768px]', mobile: 'w-[390px]' } as const
const selectedType = computed(() => (selectedBlock.value ? builder.typeOf(selectedBlock.value.type) : undefined))
const selectedIndex = computed(() => blocks.value.findIndex(b => b.id === selected.value))
const status = computed(() => {
  if (conflict.value) return t('admin.builder.saveConflict')
  if (saving.value) return t('admin.builder.saving')
  if (errors.value.length) return t('admin.builder.invalid', { n: errors.value.length })
  if (dirty.value) return t('admin.builder.unsaved')
  return lastSaved.value ? t('admin.builder.saved') : (tree.value?.has_unpublished_changes ? t('admin.builder.status.changes') : t('admin.builder.upToDate'))
})

function openAdd(position: number) {
  addPosition.value = position
  addOpen.value = true
}
function editShared(id: string) {
  sharedId.value = id
  sharedOpen.value = true
}
function onSharedSaved(saved: BlockDraft) {
  for (const b of blocks.value) if (b.shared_block_id === saved.id) b.shared = saved
  builder.postToPreview({ type: 'mz:refresh' })
}
async function reload() {
  await builder.load()
  builder.postToPreview({ type: 'mz:refresh' })
}
async function onPublished() {
  await builder.load()
}

onBeforeRouteLeave(() => {
  if ((dirty.value || saving.value) && !window.confirm(t('admin.builder.leaveConfirm'))) return false
})
</script>

<template>
  <div class="-m-4 flex h-[calc(100svh-var(--ui-header-height))] flex-col sm:-m-6">
    <div class="flex flex-wrap items-center gap-3 border-b border-default px-4 py-2">
      <UButton to="/admin/pages" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :aria-label="t('admin.builder.backToPages')" />
      <h1 class="text-body font-medium">{{ tree?.page.translations.fr?.title ?? t('admin.builder.title') }}</h1>
      <span class="text-small text-muted" role="status" data-testid="save-status">{{ status }}</span>
      <div class="ms-auto flex flex-wrap items-center gap-2">
        <UFieldGroup>
          <UButton v-for="d in (['desktop', 'tablet', 'mobile'] as const)" :key="d" :icon="{ desktop: 'i-lucide-monitor', tablet: 'i-lucide-tablet', mobile: 'i-lucide-smartphone' }[d]" size="sm" :color="device === d ? 'primary' : 'neutral'" :variant="device === d ? 'soft' : 'ghost'" :aria-label="t(`admin.builder.devices.${d}`)" :aria-pressed="device === d" @click="device = d" />
        </UFieldGroup>
        <USelect v-model="previewLocale" :items="locales.map(l => ({ label: l.code.toUpperCase(), value: String(l.code) }))" size="sm" class="w-20" :aria-label="t('admin.builder.previewLanguage')" data-testid="preview-locale" />
        <UButton :label="t('admin.builder.history')" icon="i-lucide-history" size="sm" color="neutral" variant="ghost" @click="historyOpen = true" />
        <UButton v-if="canPublish" :label="t('admin.builder.publish.open')" icon="i-lucide-send" size="sm" data-testid="publish-open" @click="publishOpen = true" />
      </div>
    </div>
    <UAlert v-if="revisionPreview" color="info" variant="subtle" class="rounded-none" :title="t('admin.builder.revisions.previewing')" :actions="[{ label: t('admin.builder.revisions.backToDraft'), onClick: () => { revisionPreview = null } }]" />

    <div class="flex min-h-0 flex-1">
      <aside class="w-72 shrink-0 overflow-y-auto border-e border-default p-3" :aria-label="t('admin.builder.sections')">
        <MzBuilderSectionList :builder="builder" @add="openAdd" />
      </aside>
      <main class="flex min-w-0 flex-1 justify-center overflow-auto bg-muted p-4">
        <iframe
          ref="frame"
          :key="`${previewLocale}-${revisionPreview}`"
          :src="src"
          :title="t('admin.builder.preview')"
          class="h-full rounded-sm border border-default bg-default shadow-overlay transition-[width]"
          :class="widths[device]"
          data-testid="preview-frame"
        />
      </main>
      <aside class="w-96 shrink-0 overflow-y-auto border-s border-default p-4" :aria-label="t('admin.builder.settings')">
        <MzBuilderSectionForm
          v-if="selectedBlock && selectedType"
          v-model="blocks[selectedIndex]!"
          :type="selectedType"
          :index="selectedIndex"
          :errors="builder.errorsUnder(`/blocks/${selectedIndex}`)"
          :appearance-schema="builder.appearanceSchema.value"
          @edit-shared="editShared"
        />
        <MzEmptyState v-else icon="i-lucide-mouse-pointer-click" :title="t('admin.builder.selectHint')" />
      </aside>
    </div>

    <MzBuilderAddDialog v-model:open="addOpen" :builder="builder" :position="addPosition" :page-type="tree?.page.page_type ?? 'page'" />
    <MzBuilderPublish v-model:open="publishOpen" :builder="builder" :page-id="pageId" @published="onPublished" />
    <MzBuilderRevisions v-model:open="historyOpen" :builder="builder" :page-id="pageId" :can-publish="canPublish" @preview="id => (revisionPreview = id)" />
    <MzSharedSectionEditor v-model:open="sharedOpen" :builder="builder" :shared-id="sharedId" :appearance-schema="builder.appearanceSchema.value" @saved="onSharedSaved" />
    <UModal :open="!!conflict" :dismissible="false" :title="t('admin.builder.conflict.title')">
      <template #body>
        <p>{{ conflict?.saved_by ? t('admin.builder.conflict.by', { name: conflict.saved_by.name }) : t('admin.builder.conflict.someone') }}</p>
        <p class="mt-2 text-small text-muted">{{ t('admin.builder.conflict.text') }}</p>
      </template>
      <template #footer>
        <UButton :label="t('admin.builder.conflict.reload')" icon="i-lucide-refresh-cw" data-testid="conflict-reload" @click="reload" />
      </template>
    </UModal>
  </div>
</template>
