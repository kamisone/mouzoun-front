<script setup lang="ts">
import type { AdminCategoryRow } from '~/utils/shop-admin-api'
import type { CategoryScope } from '~/composables/useCategoryScope'
import { canPlace, flatten } from '~/utils/category-tree'

/**
 * Picks categories of one scope (shop by default; `product` for stays and activities), one or
 * several, from the tree, with search: shipping, promotions, the variation library, the product
 * editor, the parent field of the category form and the delete dialog all use it.
 * No editing here. `parentOf` turns it into a parent picker: the category itself, its
 * descendants and levels beyond the depth limit are disabled.
 */
const props = withDefaults(defineProps<{
  multiple?: boolean
  placeholder?: string
  /** Offer "none" (value `null`): a root category, no category... */
  noneLabel?: string
  /** Parent picker for this category id (`''` for a new category). */
  parentOf?: string | null
  /** Ids that cannot be chosen (the category being deleted...). */
  exclude?: string[]
  disabled?: boolean
  scope?: CategoryScope
}>(), { multiple: false, placeholder: undefined, noneLabel: undefined, parentOf: null, exclude: () => [], disabled: false, scope: 'shop' })
const model = defineModel<string | string[] | null | undefined>()
const { t } = useI18n()
const { api, listKey } = useCategoryScope(props.scope)
const { data } = await useAsyncData(listKey, () => api.list())

const NONE = '__none__'
const items = computed(() => {
  const rows = (data.value?.data ?? []) as AdminCategoryRow[]
  const maxDepth = data.value?.max_depth ?? 3
  const list = flatten(rows).map(({ row, depth }) => {
    const name = row.translations.fr?.name ?? Object.values(row.translations)[0]?.name ?? row.id
    let disabled = props.exclude.includes(row.id)
    if (props.parentOf !== null) {
      disabled ||= props.parentOf
        ? canPlace(rows, props.parentOf, row.id, maxDepth) !== null
        : depth + 1 > maxDepth
    }
    return {
      value: row.id,
      label: name,
      // Indentation shows the tree; search still matches the name.
      prefix: depth > 1 ? `${'   '.repeat(depth - 2)}└ ` : '',
      description: row.is_active ? undefined : t('admin.shop.categories.status.inactive'),
      disabled,
    }
  })
  return props.noneLabel && !props.multiple ? [{ value: NONE, label: props.noneLabel, prefix: '', description: undefined, disabled: false }, ...list] : list
})
const value = computed({
  get: () => (props.multiple ? (model.value ?? []) : (model.value ?? (props.noneLabel ? NONE : undefined))),
  set: (v) => { model.value = v === NONE ? null : (v as string | string[]) },
})
</script>

<template>
  <USelectMenu
    v-model="value"
    :items="items"
    value-key="value"
    :multiple="props.multiple"
    :placeholder="props.placeholder ?? t('admin.shop.categories.pick')"
    :search-input="{ placeholder: t('admin.shop.categories.search') }"
    :disabled="props.disabled"
    class="w-full"
    data-testid="category-picker"
  >
    <template #item-label="{ item }">
      <span class="whitespace-pre text-muted" aria-hidden="true">{{ item.prefix }}</span>{{ item.label }}
    </template>
  </USelectMenu>
</template>
