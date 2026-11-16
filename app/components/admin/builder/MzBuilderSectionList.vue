<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { BlockDraft } from '~/utils/page-types'
import type { Builder } from '~/composables/useBuilder'

/**
 * Left panel: the page's sections in order. Drag and drop, or keyboard (focus a row, Alt + ↑/↓),
 * eye toggle, badges (scheduled, one device only, hidden in a language, shared, errors) and a
 * menu (add below, duplicate, rename, convert to shared, delete with undo).
 */
const props = defineProps<{ builder: Builder }>()
const emit = defineEmits<{ add: [position: number] }>()
const { t, locale } = useI18n()
const b = props.builder
const dragging = ref<number | null>(null)
const over = ref<number | null>(null)
const announcement = ref('')

function title(block: BlockDraft) {
  const source = block.shared ?? block
  const c = source.content[locale.value] ?? source.content.fr ?? {}
  return block.name || source.name || (c.title as string) || b.typeOf(block.type)?.name || block.type
}
function onKey(e: KeyboardEvent, i: number) {
  if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return
  e.preventDefault()
  const to = e.key === 'ArrowUp' ? i - 1 : i + 1
  if (to < 0 || to >= b.blocks.value.length) return
  b.move(i, to)
  announcement.value = t('admin.builder.movedTo', { n: to + 1, total: b.blocks.value.length })
  nextTick(() => document.querySelector<HTMLElement>(`[data-row="${to}"]`)?.focus())
}
function onDrop(to: number) {
  if (dragging.value !== null) b.move(dragging.value, to)
  dragging.value = null
  over.value = null
}
function rename(block: BlockDraft) {
  const name = window.prompt(t('admin.builder.rename'), block.name ?? title(block))
  if (name !== null) block.name = name.trim() || null
}
function menu(block: BlockDraft, i: number): DropdownMenuItem[][] {
  return [
    [
      { label: t('admin.builder.addBelow'), icon: 'i-lucide-plus', onSelect: () => emit('add', i + 1) },
      { label: t('admin.builder.duplicate'), icon: 'i-lucide-copy', onSelect: () => b.duplicate(block.id) },
      { label: t('admin.builder.rename'), icon: 'i-lucide-pencil', onSelect: () => rename(block) },
      ...(block.shared_block_id ? [] : [{ label: t('admin.builder.convertShared'), icon: 'i-lucide-link', onSelect: () => b.convertToShared(block.id) }]),
    ],
    [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => b.remove(block.id) }],
  ]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <p class="text-caption text-muted">{{ t('admin.builder.reorderHint') }}</p>
    <ol class="flex flex-col gap-1" :aria-label="t('admin.builder.sections')" data-testid="section-list">
      <li
        v-for="(block, i) in b.blocks.value"
        :key="block.id"
        :data-row="i"
        :data-testid="`section-row-${i}`"
        tabindex="0"
        draggable="true"
        class="group flex items-center gap-2 rounded-sm border px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="[
          b.selected.value === block.id ? 'border-primary bg-primary/5' : 'border-default hover:bg-muted',
          over === i && dragging !== i && 'border-dashed border-primary',
          dragging === i && 'opacity-50',
        ]"
        :aria-current="b.selected.value === block.id"
        @click="b.select(block.id)"
        @keydown.enter.self="b.select(block.id)"
        @keydown="onKey($event, i)"
        @dragstart="dragging = i"
        @dragover.prevent="over = i"
        @dragleave="over = null"
        @drop="onDrop(i)"
        @dragend="dragging = null; over = null"
      >
        <UIcon name="i-lucide-grip-vertical" class="size-4 shrink-0 cursor-grab text-muted" aria-hidden="true" />
        <UIcon :name="b.typeOf(block.type)?.icon ?? 'i-lucide-square'" class="size-4 shrink-0 text-toned" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-small" :class="!block.is_visible && 'text-muted line-through'">{{ title(block) }}</p>
          <div class="mt-1 flex flex-wrap gap-1">
            <UBadge v-if="block.shared_block_id" :label="t('admin.builder.badges.shared')" icon="i-lucide-link" size="sm" color="info" variant="subtle" />
            <UBadge v-if="block.active_period" :label="t('admin.builder.badges.scheduled')" icon="i-lucide-calendar-clock" size="sm" color="info" variant="subtle" />
            <UBadge v-if="block.visible_on !== 'all'" :label="t(`admin.builder.badges.${block.visible_on}`)" :icon="block.visible_on === 'mobile' ? 'i-lucide-smartphone' : 'i-lucide-monitor'" size="sm" color="neutral" variant="subtle" />
            <UBadge v-if="block.hidden_locales.length" :label="t('admin.builder.badges.hiddenIn', { locales: block.hidden_locales.join(', ').toUpperCase() })" size="sm" color="neutral" variant="subtle" />
            <UBadge v-if="b.errorCount(block.id)" :label="t('admin.builder.badges.errors', { n: b.errorCount(block.id) })" icon="i-lucide-circle-alert" size="sm" color="error" variant="subtle" />
          </div>
        </div>
        <UButton
          :icon="block.is_visible ? 'i-lucide-eye' : 'i-lucide-eye-off'"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="block.is_visible ? t('admin.builder.hide') : t('admin.builder.show')"
          :aria-pressed="!block.is_visible"
          @click.stop="block.is_visible = !block.is_visible"
        />
        <UDropdownMenu :items="menu(block, i)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.actions')" @click.stop />
        </UDropdownMenu>
      </li>
    </ol>
    <UButton :label="t('admin.builder.add')" icon="i-lucide-plus" color="neutral" variant="outline" block data-testid="add-section" @click="emit('add', b.blocks.value.length)" />
  </div>
</template>
