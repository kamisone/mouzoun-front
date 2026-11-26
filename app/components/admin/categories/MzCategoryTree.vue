<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AdminCategoryRow } from '~/utils/shop-admin-api'
import type { DropPosition, MoveKey, Placement, Refusal, TreeItem } from '~/utils/category-tree'
import { canPlace, dropPlacement, flatten, keyPlacement, place } from '~/utils/category-tree'

/**
 * Categories as a tree. Drag a row onto another to nest it, between two rows to reorder;
 * or focus a row's handle and use the arrow keys (↑ ↓ move, → indent, ← outdent), or the row
 * menu (Monter, Descendre, Indenter, Désindenter). Every move emits the same payload
 * (`PUT …/categories/tree`); refused moves (cycle, depth) emit `refused`. Moves are announced
 * in an aria-live region. Read-only without the write permission. With `maxDepth` 1 (stays
 * and activities) it is a flat ordered list: no nesting actions, no "hidden from menu" badge.
 */
const props = withDefaults(defineProps<{
  rows: AdminCategoryRow[]
  maxDepth: number
  readOnly?: boolean
  /** Filters the rows (name or slug) and opens the branches that match. */
  search?: string
  status?: 'all' | 'active' | 'inactive' | 'hidden'
  /** Public URL of a category (View on site). */
  siteUrl?: (row: AdminCategoryRow) => string | null
  /** Admin form of a category: `${base}/${id}`. */
  base?: string
  /** Show the "hidden from menu" state (shop categories only). */
  menus?: boolean
}>(), { readOnly: false, search: '', status: 'all', siteUrl: undefined, base: '/admin/shop/categories', menus: true })
const flat = computed(() => props.maxDepth <= 1)
const emit = defineEmits<{
  move: [items: TreeItem[], announcement: string]
  refused: [reason: Refusal]
  edit: [row: AdminCategoryRow]
  addChild: [row: AdminCategoryRow]
  toggleActive: [row: AdminCategoryRow]
  remove: [row: AdminCategoryRow]
}>()
const collapsed = defineModel<string[]>('collapsed', { default: () => [] })
const { t } = useI18n()
const LOCALES = ['fr', 'en', 'ar'] as const

const name = (r: AdminCategoryRow) => r.translations.fr?.name ?? Object.values(r.translations)[0]?.name ?? '—'
const missing = (r: AdminCategoryRow) => LOCALES.filter(l => !r.translations[l]?.name)

// ---- Filtering: matches plus their ancestors, opened ------------------------------------------
const matches = computed(() => {
  const q = props.search.trim().toLowerCase()
  const byStatus = (r: AdminCategoryRow) =>
    props.status === 'all'
    || (props.status === 'active' && r.is_active)
    || (props.status === 'inactive' && !r.is_active)
    || (props.status === 'hidden' && !r.show_in_menu)
  const hit = (r: AdminCategoryRow) => byStatus(r) && (!q || Object.values(r.translations).some(tr => tr.name.toLowerCase().includes(q) || tr.slug.includes(q)))
  if (!q && props.status === 'all') return null
  const keep = new Set<string>()
  for (const r of props.rows.filter(hit)) {
    let cur: AdminCategoryRow | undefined = r
    while (cur && !keep.has(cur.id)) {
      keep.add(cur.id)
      cur = props.rows.find(x => x.id === cur!.parent_id)
    }
  }
  return keep
})
const filtering = computed(() => matches.value !== null)
const nodes = computed(() => {
  const visible = matches.value
  const rows = visible ? props.rows.filter(r => visible.has(r.id)) : props.rows
  return flatten(rows, visible ? new Set() : new Set(collapsed.value))
})
const canMove = computed(() => !props.readOnly && !filtering.value)

function toggle(id: string) {
  collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(x => x !== id) : [...collapsed.value, id]
}

// ---- Moves ------------------------------------------------------------------------------------
const announcement = ref('')
function commit(id: string, target: Placement | null) {
  if (!target) return
  const refusal = canPlace(props.rows, id, target.parentId, props.maxDepth)
  if (refusal) {
    announcement.value = t(`admin.shop.categories.refused.${refusal}`)
    emit('refused', refusal)
    return
  }
  const items = place(props.rows, id, target)
  if (!items.length) return
  const row = props.rows.find(r => r.id === id)!
  const parent = props.rows.find(r => r.id === target.parentId)
  const text = parent
    ? t('admin.shop.categories.movedInto', { name: name(row), parent: name(parent), n: target.index + 1 })
    : t('admin.shop.categories.movedRoot', { name: name(row), n: target.index + 1 })
  announcement.value = text
  emit('move', items, text)
  // Keep the handle focused after the list re-renders.
  nextTick(() => document.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus())
}
function keyMove(id: string, key: MoveKey) {
  const target = keyPlacement(props.rows, id, key)
  if (target?.parentId && collapsed.value.includes(target.parentId)) toggle(target.parentId)
  commit(id, target)
}
function onHandleKey(e: KeyboardEvent, id: string) {
  const keys: Record<string, MoveKey> = { ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'indent', ArrowLeft: 'outdent' }
  const key = keys[e.key]
  if (!key || !canMove.value || (flat.value && (key === 'indent' || key === 'outdent'))) return
  e.preventDefault()
  keyMove(id, key)
}

// Drag and drop (mouse): the top and bottom quarters of a row mean "before" / "after" (halves
// in a flat list: nothing nests).
const dragging = ref<string | null>(null)
const over = ref<{ id: string, position: DropPosition } | null>(null)
function positionIn(e: DragEvent): DropPosition {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = (e.clientY - box.top) / Math.max(1, box.height)
  if (flat.value) return y < 0.5 ? 'before' : 'after'
  return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside'
}
function onDragStart(e: DragEvent, id: string) {
  if (!canMove.value) return
  dragging.value = id
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(e: DragEvent, id: string) {
  if (!dragging.value) return
  e.preventDefault()
  over.value = { id, position: positionIn(e) }
}
function onDrop(e: DragEvent, id: string) {
  e.preventDefault()
  const from = dragging.value
  const position = over.value?.id === id ? over.value.position : positionIn(e)
  dragging.value = null
  over.value = null
  if (!from) return
  commit(from, dropPlacement(props.rows, from, id, position))
}
function onDragEnd() {
  dragging.value = null
  over.value = null
}

function menu(row: AdminCategoryRow): DropdownMenuItem[][] {
  const site = props.siteUrl?.(row)
  const view: DropdownMenuItem[] = [
    { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => emit('edit', row) },
    ...(site && row.is_active ? [{ label: t('admin.shop.categories.viewOnSite'), icon: 'i-lucide-external-link', to: site, target: '_blank' }] : []),
  ]
  if (props.readOnly) return [view]
  const moves: DropdownMenuItem[] = (flat.value ? ['up', 'down'] as const : ['up', 'down', 'indent', 'outdent'] as const).map(k => ({
    label: t(`admin.shop.categories.moves.${k}`),
    icon: { up: 'i-lucide-arrow-up', down: 'i-lucide-arrow-down', indent: 'i-lucide-indent-increase', outdent: 'i-lucide-indent-decrease' }[k],
    disabled: filtering.value || !keyPlacement(props.rows, row.id, k),
    onSelect: () => keyMove(row.id, k),
  }))
  return [
    flat.value ? view : [...view, { label: t('admin.shop.categories.addChild'), icon: 'i-lucide-plus', onSelect: () => emit('addChild', row) }],
    moves,
    [
      { label: row.is_active ? t('admin.shop.categories.deactivate') : t('admin.shop.categories.activate'), icon: row.is_active ? 'i-lucide-eye-off' : 'i-lucide-eye', onSelect: () => emit('toggleActive', row) },
      { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => emit('remove', row) },
    ],
  ]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="sr-only" aria-live="polite" data-testid="tree-announcement">{{ announcement }}</p>
    <p v-if="canMove" class="text-caption text-muted">{{ t(flat ? 'admin.catalog.categoryAdmin.moveHint' : 'admin.shop.categories.moveHint') }}</p>
    <p v-else-if="filtering && !props.readOnly" class="text-caption text-muted">{{ t('admin.shop.categories.filterHint') }}</p>
    <ul role="tree" :aria-label="t(props.menus ? 'admin.shop.nav.categories' : 'admin.catalog.nav.categories')" class="flex flex-col rounded-md border border-default" data-testid="category-tree">
      <li
        v-for="node in nodes"
        :key="node.row.id"
        role="treeitem"
        :aria-level="node.depth"
        :aria-expanded="node.hasChildren ? !collapsed.includes(node.row.id) || filtering : undefined"
        :aria-selected="false"
        :data-testid="`category-row-${node.row.id}`"
        :draggable="canMove"
        class="relative flex items-center gap-2 border-t border-default py-2 pe-2 first:border-t-0"
        :class="[
          dragging === node.row.id && 'opacity-50',
          over?.id === node.row.id && over.position === 'inside' && 'bg-primary/10 ring-2 ring-inset ring-primary',
        ]"
        :style="{ paddingInlineStart: `${(node.depth - 1) * 1.75 + 0.5}rem` }"
        @dragstart="onDragStart($event, node.row.id)"
        @dragover="onDragOver($event, node.row.id)"
        @dragleave="over = null"
        @drop="onDrop($event, node.row.id)"
        @dragend="onDragEnd"
      >
        <!-- Drop indicator between rows. -->
        <span v-if="over?.id === node.row.id && over.position !== 'inside'" class="pointer-events-none absolute inset-x-0 h-0.5 bg-primary" :class="over.position === 'before' ? 'top-0' : 'bottom-0'" aria-hidden="true" />
        <button
          v-if="canMove"
          type="button"
          class="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
          :data-handle="node.row.id"
          :aria-label="t('admin.shop.categories.handle', { name: name(node.row) })"
          :aria-describedby="`move-help`"
          @keydown="onHandleKey($event, node.row.id)"
        >
          <UIcon name="i-lucide-grip-vertical" class="size-4" />
        </button>
        <UButton
          v-if="node.hasChildren"
          :icon="collapsed.includes(node.row.id) && !filtering ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
          color="neutral"
          variant="ghost"
          size="xs"
          class="rtl:rotate-180"
          :aria-label="collapsed.includes(node.row.id) ? t('admin.shop.categories.expand', { name: name(node.row) }) : t('admin.shop.categories.collapse', { name: name(node.row) })"
          :disabled="filtering"
          @click="toggle(node.row.id)"
        />
        <span v-else class="size-6 shrink-0" aria-hidden="true" />
        <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-elevated" aria-hidden="true">
          <img v-if="node.row.cover_url" :src="node.row.cover_url" alt="" class="size-full object-cover" loading="lazy" draggable="false">
          <UIcon v-else :name="node.row.icon || 'i-lucide-folder'" class="size-4 text-muted" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col">
          <NuxtLink :to="`${props.base}/${node.row.id}`" class="truncate font-medium hover:underline" draggable="false">{{ name(node.row) }}</NuxtLink>
          <span class="truncate text-caption text-muted" dir="ltr">/{{ node.row.translations.fr?.slug }}</span>
        </div>
        <div class="hidden flex-wrap items-center justify-end gap-1 md:flex">
          <UBadge v-for="l in missing(node.row)" :key="l" color="warning" variant="soft" size="sm" :label="l.toUpperCase()" :title="t('admin.shop.categories.missingLocale', { locale: l.toUpperCase() })" />
        </div>
        <span
          class="w-20 shrink-0 text-end text-small tabular-nums"
          :title="t('admin.shop.categories.countHint', { published: node.row.published_count_total, total: node.row.product_count_total })"
        >
          {{ node.row.published_count }} / {{ node.row.product_count }}
        </span>
        <UBadge
          :color="!node.row.is_active ? 'neutral' : node.row.show_in_menu || !props.menus ? 'success' : 'warning'"
          variant="soft"
          size="sm"
          class="shrink-0"
          :label="!node.row.is_active ? t('admin.shop.categories.status.inactive') : node.row.show_in_menu || !props.menus ? t('admin.shop.categories.status.active') : t('admin.shop.categories.status.hidden')"
        />
        <UDropdownMenu :items="menu(node.row)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" :aria-label="t('admin.shop.categories.actions', { name: name(node.row) })" :data-testid="`category-menu-${node.row.id}`" />
        </UDropdownMenu>
      </li>
    </ul>
    <p id="move-help" class="sr-only">{{ t(flat ? 'admin.catalog.categoryAdmin.keyboardHelp' : 'admin.shop.categories.keyboardHelp') }}</p>
  </div>
</template>
