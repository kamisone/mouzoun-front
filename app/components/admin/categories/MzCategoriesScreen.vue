<script setup lang="ts">
import type { AdminCategoryRow } from '~/utils/shop-admin-api'
import type { Refusal, TreeItem } from '~/utils/category-tree'
import type { CategoryScope } from '~/composables/useCategoryScope'
import { applyItems } from '~/utils/category-tree'

/**
 * Categories of one scope: Admin › Boutique › Catégories (`shop`: a tree) and Admin › Catalogue
 * › Catégories (`product`: stays and activities, one flat ordered list). Drag and drop, keyboard
 * and menu moves, saved in one call each; search and status filter, expand/collapse remembered
 * in this browser, product counts, status and missing translations. Empty state with suggested
 * categories. Read-only without the scope's write permission.
 */
const props = defineProps<{ scope: CategoryScope }>()
const { t } = useI18n()
const toast = useToast()
const { act } = useShopAdmin()
const { api, base, listKey, titleKey, canWrite, shop } = useCategoryScope(props.scope)
const readOnly = computed(() => !canWrite())
/** Texts that differ for stays and activities (`admin.catalog.categoryAdmin.*`). */
const text = (key: string) => t(shop ? `admin.shop.categories.${key}` : `admin.catalog.categoryAdmin.${key}`)
const { data, refresh, pending } = await useAsyncData(listKey, () => api.list())

// Rows shown (optimistic moves), the server's version of the tree.
const rows = ref<AdminCategoryRow[]>([])
const version = ref('')
watch(data, (d) => {
  rows.value = d?.data ?? []
  version.value = d?.version ?? ''
}, { immediate: true })

const search = ref('')
const status = ref<'all' | 'active' | 'inactive' | 'hidden'>('all')
/** Collapsed branches, per browser (storage may be unavailable: then nothing is remembered). */
// Literal keys: the cookie policy test scans the sources for them.
const collapsed = useLocalStorage<string[]>(shop ? 'mz-admin-shop-categories-collapsed' : 'mz-admin-product-categories-collapsed', [], { onError: () => {} })
const statuses = shop ? (['all', 'active', 'inactive', 'hidden'] as const) : (['all', 'active', 'inactive'] as const)

const saving = ref(false)
async function move(items: TreeItem[]) {
  const before = rows.value
  rows.value = applyItems(rows.value, items)
  saving.value = true
  try {
    const out = await api.tree(version.value, items)
    version.value = out.version
    await refresh()
  }
  catch (e) {
    rows.value = before
    const code = (e as { data?: { error?: { code?: string } } }).data?.error?.code
    toast.add({ title: t(code === 'tree_changed' ? 'admin.shop.categories.treeChanged' : code ? `admin.shop.errors.${code}` : 'shop.errors.generic'), color: 'error' })
    if (code === 'tree_changed') await refresh()
  }
  finally {
    saving.value = false
  }
}
function refused(reason: Refusal) {
  toast.add({ title: t(`admin.shop.categories.refused.${reason}`), color: 'warning' })
}

async function toggleActive(row: AdminCategoryRow) {
  if (await act(() => api.save({ is_active: !row.is_active }, row.id), row.is_active ? t('admin.shop.categories.deactivated') : t('admin.shop.categories.activated')) !== undefined) await refresh()
}

const toDelete = ref<AdminCategoryRow | null>(null)
const deleteOpen = ref(false)
function askDelete(row: AdminCategoryRow) {
  toDelete.value = row
  deleteOpen.value = true
}

const localePath = useLocalePath()
// Only shop categories have a page of their own.
const siteUrl = (row: AdminCategoryRow) => (shop && row.translations.fr?.slug ? localePath({ name: 'shop-category', params: { category: row.translations.fr.slug } }, 'fr') : null)

function expandAll(open: boolean) {
  collapsed.value = open ? [] : rows.value.filter(r => rows.value.some(c => c.parent_id === r.id)).map(r => r.id)
}

const suggesting = ref(false)
async function suggest() {
  suggesting.value = true
  const out = await act(() => api.suggested())
  suggesting.value = false
  if (out) {
    toast.add({ title: t('admin.shop.categories.suggestedDone', { n: out.created }), color: 'success' })
    await refresh()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t(titleKey)" :description="text('intro')">
      <template #actions>
        <UButton v-if="!readOnly" icon="i-lucide-plus" :label="t('admin.shop.categories.new')" :to="`${base}/new`" data-testid="new-category" />
      </template>
    </MzPageHeader>

    <MzEmptyState
      v-if="!pending && !rows.length"
      icon="i-lucide-folder-tree"
      :title="t('admin.shop.categories.emptyTitle')"
      :description="text('emptyText')"
    >
      <div v-if="!readOnly" class="flex flex-wrap justify-center gap-2">
        <UButton icon="i-lucide-plus" :label="t('admin.shop.categories.create')" :to="`${base}/new`" />
        <UButton icon="i-lucide-sparkles" :label="t('admin.shop.categories.suggested')" color="neutral" variant="outline" :loading="suggesting" data-testid="suggest-categories" @click="suggest" />
      </div>
    </MzEmptyState>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('admin.shop.categories.search')" :aria-label="t('admin.shop.categories.search')" class="w-64" />
        <USelect
          v-model="status"
          :items="statuses.map(s => ({ value: s, label: s === 'all' ? t('admin.shop.orders.any') : t(`admin.shop.categories.status.${s}`) }))"
          :aria-label="t('admin.shop.orders.status')"
          class="w-44"
        />
        <div v-if="shop" class="ms-auto flex gap-1">
          <UButton :label="t('admin.shop.categories.expandAll')" icon="i-lucide-chevrons-up-down" color="neutral" variant="ghost" size="sm" @click="expandAll(true)" />
          <UButton :label="t('admin.shop.categories.collapseAll')" icon="i-lucide-chevrons-down-up" color="neutral" variant="ghost" size="sm" @click="expandAll(false)" />
        </div>
      </div>
      <div :aria-busy="saving">
        <MzCategoryTree
          v-model:collapsed="collapsed"
          :rows="rows"
          :max-depth="data?.max_depth ?? 3"
          :read-only="readOnly"
          :search="search"
          :status="status"
          :site-url="siteUrl"
          :base="base"
          :menus="shop"
          @move="move"
          @refused="refused"
          @edit="row => navigateTo(`${base}/${row.id}`)"
          @add-child="row => navigateTo({ path: `${base}/new`, query: { parent: row.id } })"
          @toggle-active="toggleActive"
          @remove="askDelete"
        />
      </div>
    </template>

    <MzCategoryDeleteDialog
      v-model:open="deleteOpen"
      :category-id="toDelete?.id ?? null"
      :category-name="toDelete?.translations.fr?.name ?? ''"
      :scope="props.scope"
      @deleted="refresh()"
      @deactivate="toDelete?.is_active && toggleActive(toDelete)"
    />
  </div>
</template>
