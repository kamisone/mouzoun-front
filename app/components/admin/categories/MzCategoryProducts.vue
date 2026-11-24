<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * Products of a category in the category form: thumbnail, status, stock; add (search), remove,
 * drag to reorder (or Alt + ↑/↓ on a row) and pin. Order and pins only matter with the manual
 * sort: with an automatic sort they are shown, not editable. Saved at once (own endpoints).
 */
const props = defineProps<{ categoryId: string, defaultSort: string, readOnly?: boolean }>()
const { t } = useI18n()
const admin = useAdminApi()
const { act } = useShopAdmin()

const { data, refresh, pending } = await useAsyncData(`admin-category-products-${props.categoryId}`, () => admin.shop.categories.products(props.categoryId))
const items = ref<Json[]>([])
watch(data, d => (items.value = [...(d?.data ?? [])]), { immediate: true })
const manual = computed(() => props.defaultSort === 'manual')
const editable = computed(() => !props.readOnly && manual.value)
const announcement = ref('')

/** Pinned first, then the manual order: what the shop shows. */
function normalise(list: Json[]) {
  return [...list.filter(p => p.is_pinned), ...list.filter(p => !p.is_pinned)].map((p, i) => ({ ...p, sort_order: i }))
}
async function persist(next: Json[], message?: string) {
  const before = items.value
  items.value = normalise(next)
  // 204: `$fetch` resolves with nothing, so the action returns `true` itself.
  const ok = await act(async () => {
    await admin.shop.categories.orderProducts(props.categoryId, items.value.map(p => ({ product_id: p.product_id, sort_order: p.sort_order, is_pinned: p.is_pinned })))
    return true
  })
  if (!ok) items.value = before
  else if (message) announcement.value = message
}
function move(from: number, to: number) {
  if (to < 0 || to >= items.value.length || from === to) return
  const next = [...items.value]
  const [row] = next.splice(from, 1)
  // A row keeps its pin: it cannot cross the pinned/unpinned boundary.
  next.splice(to, 0, row!)
  void persist(next, t('admin.shop.categories.productMoved', { n: to + 1, total: next.length }))
}
function togglePin(i: number) {
  const next = items.value.map((p, j) => (j === i ? { ...p, is_pinned: !p.is_pinned } : p))
  void persist(next)
}
function onKey(e: KeyboardEvent, i: number) {
  if (!editable.value || !e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return
  e.preventDefault()
  move(i, e.key === 'ArrowUp' ? i - 1 : i + 1)
  nextTick(() => document.querySelector<HTMLElement>(`[data-product-row="${e.key === 'ArrowUp' ? i - 1 : i + 1}"]`)?.focus())
}
const dragging = ref<number | null>(null)
const over = ref<number | null>(null)
function onDrop(i: number) {
  if (dragging.value !== null) move(dragging.value, i)
  dragging.value = null
  over.value = null
}

async function remove(p: Json) {
  const ok = await act(async () => {
    await admin.shop.categories.removeProduct(props.categoryId, p.product_id)
    return true
  })
  if (ok) await refresh()
}

// Add: search the shop products.
const toAdd = ref<string[]>([])
const term = ref('')
const options = ref<{ value: string, label: string }[]>([])
watchDebounced(term, async (q) => {
  const res = await admin.shop.products.list({ q: q || undefined, per_page: 20 }).catch(() => null)
  options.value = (res?.data ?? []).filter(p => !items.value.some(i => i.product_id === p.id)).map(p => ({ value: p.id, label: p.name }))
}, { debounce: 250, immediate: true })
async function add() {
  if (!toAdd.value.length) return
  if (await act(() => admin.shop.categories.addProducts(props.categoryId, toAdd.value)) !== undefined) {
    toAdd.value = []
    await refresh()
  }
}
const statusColor = (s: string) => (s === 'published' ? 'success' : s === 'draft' ? 'warning' : 'neutral')
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="category-products">
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <p v-if="!manual" class="text-small text-muted">{{ t('admin.shop.categories.autoSort', { sort: t(`admin.shop.categories.sorts.${props.defaultSort}`) }) }}</p>
    <p v-else-if="editable && items.length > 1" class="text-caption text-muted">{{ t('admin.shop.categories.productsHint') }}</p>
    <div v-if="!props.readOnly" class="flex flex-wrap items-end gap-2">
      <USelectMenu
        v-model="toAdd"
        v-model:search-term="term"
        :items="options"
        value-key="value"
        multiple
        ignore-filter
        :placeholder="t('admin.shop.categories.addProducts')"
        class="min-w-64 flex-1"
      />
      <UButton :label="t('admin.shop.categories.add')" icon="i-lucide-plus" :disabled="!toAdd.length" @click="add" />
      <UButton :label="t('admin.shop.categories.bulkFromList')" :to="`/admin/shop/products`" color="neutral" variant="link" size="sm" icon="i-lucide-list-checks" />
    </div>
    <p v-if="!pending && !items.length" class="text-small text-muted">{{ t('admin.shop.categories.noProducts') }}</p>
    <ol v-else class="flex flex-col rounded-md border border-default">
      <li
        v-for="(p, i) in items"
        :key="p.product_id"
        :data-product-row="i"
        :tabindex="editable ? 0 : undefined"
        :draggable="editable"
        class="flex items-center gap-3 border-t border-default p-2 outline-none first:border-t-0 focus-visible:ring-2 focus-visible:ring-primary"
        :class="[over === i && dragging !== i && 'bg-primary/10', dragging === i && 'opacity-50']"
        :aria-label="p.name"
        @keydown="onKey($event, i)"
        @dragstart="dragging = i"
        @dragover.prevent="over = i"
        @dragleave="over = null"
        @drop="onDrop(i)"
        @dragend="dragging = null; over = null"
      >
        <UIcon v-if="editable" name="i-lucide-grip-vertical" class="size-4 shrink-0 cursor-grab text-muted" aria-hidden="true" />
        <span class="w-6 shrink-0 text-end text-caption tabular-nums text-muted">{{ i + 1 }}</span>
        <span class="size-10 shrink-0 overflow-hidden rounded-sm bg-elevated">
          <img v-if="p.image_url" :src="p.image_url" alt="" class="size-full object-cover" loading="lazy" draggable="false">
        </span>
        <NuxtLink :to="`/admin/shop/products/${p.product_id}`" class="min-w-0 flex-1 truncate font-medium hover:underline" draggable="false">{{ p.name || p.product_id }}</NuxtLink>
        <UBadge v-if="p.is_primary" color="neutral" variant="outline" size="sm" :label="t('admin.shop.categories.primary')" />
        <UBadge :color="statusColor(p.status)" variant="soft" size="sm" :label="t(`admin.shop.products.statuses.${p.status}`)" />
        <span class="w-16 shrink-0 text-end text-small tabular-nums">{{ t('admin.shop.categories.stock', { n: p.stock }) }}</span>
        <UButton
          :icon="p.is_pinned ? 'i-lucide-pin' : 'i-lucide-pin-off'"
          :color="p.is_pinned ? 'primary' : 'neutral'"
          variant="ghost"
          size="sm"
          :disabled="!editable"
          :aria-pressed="p.is_pinned"
          :aria-label="t(p.is_pinned ? 'admin.shop.categories.unpin' : 'admin.shop.categories.pin', { name: p.name })"
          @click="togglePin(i)"
        />
        <UButton v-if="!props.readOnly" icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="t('admin.shop.categories.removeProduct', { name: p.name })" @click="remove(p)" />
      </li>
    </ol>
  </div>
</template>
