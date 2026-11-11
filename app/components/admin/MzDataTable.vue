<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { TableColumn } from '@nuxt/ui'
import type { TableQuery } from '~/composables/useTableQuery'

/**
 * Server-driven table: the rows of the current page come from the parent (fetched with
 * `useTableQuery().apiParams`); sorting, search and pagination update the URL query.
 * Columns with `meta.sortable` get a sort button in their header.
 */
const props = withDefaults(defineProps<{
  columns: TableColumn<T>[]
  rows: T[]
  total: number
  query: TableQuery
  loading?: boolean
  searchable?: boolean
  /** Sortable column ids. */
  sortable?: string[]
}>(), { loading: false, searchable: true, sortable: () => [] })

const emit = defineEmits<{ update: [patch: Partial<TableQuery>] }>()
const { t } = useI18n()
const search = ref(props.query.q)
watchDebounced(search, q => emit('update', { q }), { debounce: 300 })

function sortIcon(id: string) {
  if (props.query.sort !== id) return 'i-lucide-arrow-up-down'
  return props.query.dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}
function toggleSort(id: string) {
  const dir = props.query.sort === id && props.query.dir === 'asc' ? 'desc' : 'asc'
  emit('update', { sort: id, dir })
}

const columns = computed<TableColumn<T>[]>(() =>
  props.columns.map((column) => {
    const id = (column as { id?: string, accessorKey?: string }).id ?? (column as { accessorKey?: string }).accessorKey
    if (!id || !props.sortable.includes(id)) return column
    return {
      ...column,
      header: () => h(resolveComponent('UButton'), {
        label: typeof column.header === 'string' ? column.header : id,
        trailingIcon: sortIcon(id),
        color: 'neutral',
        variant: 'ghost',
        size: 'sm',
        class: '-ms-2.5 font-semibold',
        'aria-label': `${typeof column.header === 'string' ? column.header : id}`,
        'aria-sort': props.query.sort === id ? (props.query.dir === 'asc' ? 'ascending' : 'descending') : undefined,
        onClick: () => toggleSort(id),
      }),
    } as TableColumn<T>
  }),
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="props.searchable || $slots.toolbar" class="flex flex-wrap items-center gap-2">
      <UInput
        v-if="props.searchable"
        v-model="search"
        icon="i-lucide-search"
        size="sm"
        :placeholder="t('table.filter')"
        :aria-label="t('common.search')"
        class="w-full sm:w-72"
      />
      <slot name="toolbar" />
    </div>
    <UTable :data="props.rows" :columns="columns" :loading="props.loading" class="rounded-lg border border-default bg-elevated">
      <template #empty>
        <MzEmptyState :title="t('table.noData')" description="" icon="i-lucide-search-x" class="border-0" />
      </template>
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </UTable>
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>{{ t('table.results', { total: props.total }, props.total) }}</span>
      <UPagination
        :page="props.query.page"
        :items-per-page="props.query.perPage"
        :total="props.total"
        size="sm"
        @update:page="page => emit('update', { page })"
      />
    </div>
  </div>
</template>
