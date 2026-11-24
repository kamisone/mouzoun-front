<script setup lang="ts">
import type { CategoryImpact } from '~/utils/shop-admin-api'

/**
 * Deleting a shop category: shows what it touches (products, and how many would have no category
 * left; subcategories; promotions, active ones blocking; shipping rules; variation library entries;
 * menu links), asks where products and subcategories go and what happens to menu links, and to
 * type the name when products or subcategories are affected. Deactivating is offered instead.
 */
const props = defineProps<{ categoryId: string | null, categoryName: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ deleted: [], deactivate: [] }>()
const { t } = useI18n()
const admin = useAdminApi()
const { act } = useShopAdmin()

const impact = ref<CategoryImpact | null>(null)
const loading = ref(false)
const failed = ref(false)
const form = reactive({ products: 'move' as 'move' | 'unlink', productsTo: null as string | null, subcategories: 'parent' as 'parent' | 'other', subcategoriesTo: null as string | null, menuLinks: 'replace' as 'replace' | 'remove', confirm: '' })

watch(open, async (o) => {
  if (!o || !props.categoryId) return
  Object.assign(form, { products: 'move', productsTo: null, subcategories: 'parent', subcategoriesTo: null, menuLinks: 'replace', confirm: '' })
  impact.value = null
  failed.value = false
  loading.value = true
  try {
    impact.value = await admin.shop.categories.impact(props.categoryId)
    if (!impact.value.products) form.products = 'unlink'
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

/** What is still missing before Delete can be pressed (shown under the button). */
const missing = computed(() => {
  const i = impact.value
  if (!i) return [t('common.loading')]
  const out: string[] = []
  if (i.blocked) out.push(t('admin.shop.categories.delete.blocked'))
  if (i.products && form.products === 'move' && !form.productsTo) out.push(t('admin.shop.categories.delete.pickProducts'))
  if (i.subcategories.length && form.subcategories === 'other' && !form.subcategoriesTo) out.push(t('admin.shop.categories.delete.pickSubcategories'))
  if (i.requires_confirmation && form.confirm.trim() !== i.name.trim()) out.push(t('admin.shop.categories.delete.typeName'))
  return out
})

const deleting = ref(false)
async function confirmDelete() {
  if (!props.categoryId || missing.value.length) return
  deleting.value = true
  // 204: `$fetch` resolves with nothing, so the action returns `true` itself.
  const ok = await act(async () => {
    await admin.shop.categories.remove(props.categoryId!, {
      products_to: form.products === 'move' ? form.productsTo : null,
      subcategories_to: form.subcategories === 'other' ? form.subcategoriesTo : null,
      menu_links: form.menuLinks,
      confirm_name: form.confirm.trim() || null,
    })
    return true
  }, t('admin.shop.categories.delete.done'))
  deleting.value = false
  if (ok) {
    open.value = false
    emit('deleted')
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('admin.shop.categories.delete.title', { name: props.categoryName })" :dismissible="!deleting">
    <template #body>
      <div class="flex flex-col gap-6" data-testid="category-delete-dialog">
        <div v-if="loading" class="flex items-center gap-2 text-muted"><UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('common.loading') }}</div>
        <p v-else-if="failed" class="text-error" role="alert">{{ t('shop.errors.generic') }}</p>
        <template v-else-if="impact">
          <UAlert color="info" variant="soft" icon="i-lucide-eye-off" :title="t('admin.shop.categories.delete.preferDeactivate')">
            <template #actions><UButton :label="t('admin.shop.categories.deactivate')" size="xs" color="neutral" variant="outline" @click="open = false; emit('deactivate')" /></template>
          </UAlert>

          <ul class="grid gap-2 text-small sm:grid-cols-2" data-testid="delete-impact">
            <li><span class="font-medium tabular-nums">{{ impact.products }}</span> {{ t('admin.shop.categories.delete.products', impact.products) }}<template v-if="impact.products_without_category"> · <span class="text-warning">{{ t('admin.shop.categories.delete.orphans', { n: impact.products_without_category }) }}</span></template></li>
            <li><span class="font-medium tabular-nums">{{ impact.subcategories.length }}</span> {{ t('admin.shop.categories.delete.subcategories', impact.subcategories.length) }}</li>
            <li><span class="font-medium tabular-nums">{{ impact.promotions.length }}</span> {{ t('admin.shop.categories.delete.promotions', impact.promotions.length) }}</li>
            <li><span class="font-medium tabular-nums">{{ impact.shipping_rules.length }}</span> {{ t('admin.shop.categories.delete.shipping', impact.shipping_rules.length) }}</li>
            <li><span class="font-medium tabular-nums">{{ impact.variations.length }}</span> {{ t('admin.shop.categories.delete.variations', impact.variations.length) }}</li>
            <li><span class="font-medium tabular-nums">{{ impact.menu_links.length }}</span> {{ t('admin.shop.categories.delete.menuLinks', impact.menu_links.length) }}</li>
          </ul>

          <div v-if="impact.blocked" class="flex flex-col gap-2 rounded-md border border-error p-3" role="alert">
            <p class="font-medium text-error">{{ t('admin.shop.categories.delete.blocked') }}</p>
            <ul class="flex flex-col gap-1">
              <li v-for="p in impact.promotions.filter(p => p.active)" :key="p.id">
                <NuxtLink :to="`/admin/shop/promotions?edit=${p.id}`" class="text-error underline">{{ p.name }}</NuxtLink>
              </li>
            </ul>
          </div>

          <template v-else>
            <fieldset v-if="impact.products" class="flex flex-col gap-2">
              <legend class="mb-1 font-medium">{{ t('admin.shop.categories.delete.productsQuestion') }}</legend>
              <URadioGroup v-model="form.products" :items="[{ value: 'move', label: t('admin.shop.categories.delete.move') }, { value: 'unlink', label: t('admin.shop.categories.delete.unlink') }]" />
              <MzCategoryPicker v-if="form.products === 'move'" v-model="form.productsTo" :exclude="props.categoryId ? [props.categoryId] : []" :placeholder="t('admin.shop.categories.delete.target')" />
            </fieldset>
            <fieldset v-if="impact.subcategories.length" class="flex flex-col gap-2">
              <legend class="mb-1 font-medium">{{ t('admin.shop.categories.delete.subcategoriesQuestion') }}</legend>
              <p class="text-caption text-muted">{{ impact.subcategories.map(s => s.name).join(', ') }}</p>
              <URadioGroup v-model="form.subcategories" :items="[{ value: 'parent', label: t('admin.shop.categories.delete.toParent') }, { value: 'other', label: t('admin.shop.categories.delete.toOther') }]" />
              <MzCategoryPicker v-if="form.subcategories === 'other'" v-model="form.subcategoriesTo" :parent-of="props.categoryId" :placeholder="t('admin.shop.categories.delete.target')" />
            </fieldset>
            <fieldset v-if="impact.menu_links.length" class="flex flex-col gap-2">
              <legend class="mb-1 font-medium">{{ t('admin.shop.categories.delete.menuQuestion') }}</legend>
              <p class="text-caption text-warning">{{ impact.menu_links.map(m => m.name).join(', ') }}</p>
              <URadioGroup v-model="form.menuLinks" :items="[{ value: 'replace', label: t('admin.shop.categories.delete.menuReplace') }, { value: 'remove', label: t('admin.shop.categories.delete.menuRemove') }]" />
            </fieldset>
            <p v-if="impact.promotions.length" class="text-caption text-muted">{{ t('admin.shop.categories.delete.inactivePromotions') }}</p>
            <p class="text-caption text-muted">{{ t('admin.shop.categories.delete.redirects') }}</p>
            <UFormField v-if="impact.requires_confirmation" :label="t('admin.shop.categories.delete.confirmLabel', { name: impact.name })" name="confirm">
              <UInput v-model="form.confirm" class="w-full" autocomplete="off" data-testid="delete-confirm-name" />
            </UFormField>
          </template>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2">
        <div class="flex flex-wrap justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" :disabled="deleting" autofocus @click="open = false" />
          <UButton :label="t('common.delete')" color="error" :loading="deleting" :disabled="missing.length > 0" data-testid="delete-category" @click="confirmDelete" />
        </div>
        <p v-if="impact && missing.length" class="text-end text-caption text-muted" data-testid="delete-missing">{{ missing.join(' · ') }}</p>
      </div>
    </template>
  </UModal>
</template>
