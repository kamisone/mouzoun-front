<script setup lang="ts">
import type { BlockDraft, FieldError, SectionType } from '~/utils/page-types'
import { clone, newItem, uuidv7 } from '~/utils/page-builder'

/**
 * Repeatable items of a section (slides, features, stats...): add, duplicate, remove within the
 * type's min/max, reorder by drag and drop or with the move buttons (keyboard), schedule and
 * hide each one, and edit its fields.
 */
const props = defineProps<{ type: SectionType, path: string, errors: FieldError[] }>()
const block = defineModel<BlockDraft>({ required: true })
const { t, locale } = useI18n()
const open = ref<string | null>(block.value.items[0]?.id ?? null)
const dragging = ref<number | null>(null)
const max = computed(() => props.type.max_items ?? Infinity)
const min = computed(() => props.type.min_items)

function label(i: number) {
  const item = block.value.items[i]!
  const c = item.content[locale.value] ?? item.content.fr ?? {}
  return (c.title || c.label || c.name || item.settings.time_label || t('admin.builder.items.item', { n: i + 1 })) as string
}
function add() {
  const item = newItem(props.type)
  block.value.items.push(item)
  open.value = item.id
}
function duplicate(i: number) {
  const copy = { ...clone(block.value.items[i]!), id: uuidv7() }
  block.value.items.splice(i + 1, 0, copy)
}
function remove(i: number) {
  block.value.items.splice(i, 1)
}
function move(from: number, to: number) {
  if (to < 0 || to >= block.value.items.length) return
  const [item] = block.value.items.splice(from, 1)
  block.value.items.splice(to, 0, item!)
}
function onDrop(to: number) {
  if (dragging.value !== null) move(dragging.value, to)
  dragging.value = null
}
const itemErrors = (i: number) => props.errors.filter(e => e.path.startsWith(`${props.path}/${i}/`) || e.path === `${props.path}/${i}`)
const listError = computed(() => props.errors.find(e => e.path === props.path)?.message)
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h3 class="text-small font-medium">{{ t('admin.builder.items.title') }} <span class="text-muted">({{ block.items.length }}{{ props.type.max_items ? ` / ${props.type.max_items}` : '' }})</span></h3>
      <UButton :label="t('admin.builder.items.add')" icon="i-lucide-plus" size="xs" :disabled="block.items.length >= max" data-testid="item-add" @click="add" />
    </div>
    <p v-if="listError" class="text-small text-error" role="alert">{{ listError }}</p>
    <ol class="flex flex-col gap-2">
      <li
        v-for="(item, i) in block.items"
        :key="item.id"
        class="rounded-sm border"
        :class="[itemErrors(i).length ? 'border-error' : 'border-default', dragging === i && 'opacity-50']"
        draggable="true"
        @dragstart="dragging = i"
        @dragover.prevent
        @drop="onDrop(i)"
        @dragend="dragging = null"
      >
        <div class="flex items-center gap-1 p-2">
          <UIcon name="i-lucide-grip-vertical" class="size-4 cursor-grab text-muted" aria-hidden="true" />
          <button type="button" class="flex-1 truncate text-start text-small" :aria-expanded="open === item.id" @click="open = open === item.id ? null : item.id">
            <span :class="!item.is_visible && 'text-muted line-through'">{{ label(i) }}</span>
            <UIcon v-if="item.active_period" name="i-lucide-calendar-clock" class="ms-2 inline size-4 text-info" :aria-label="t('admin.builder.badges.scheduled')" />
          </button>
          <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, i - 1)" />
          <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === block.items.length - 1" :aria-label="t('admin.builder.moveDown')" @click="move(i, i + 1)" />
          <UButton :icon="item.is_visible ? 'i-lucide-eye' : 'i-lucide-eye-off'" size="xs" color="neutral" variant="ghost" :aria-label="item.is_visible ? t('admin.builder.hide') : t('admin.builder.show')" :aria-pressed="!item.is_visible" @click="item.is_visible = !item.is_visible" />
          <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" :disabled="block.items.length >= max" :aria-label="t('admin.builder.duplicate')" @click="duplicate(i)" />
          <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :disabled="block.items.length <= min" :aria-label="t('common.delete')" @click="remove(i)" />
        </div>
        <div v-if="open === item.id" class="flex flex-col gap-6 border-t border-default p-4">
          <MzSchemaFields v-if="props.type.item_content_schema" v-model="item.content" :root="props.type.item_content_schema" :path="`${props.path}/${i}/content`" :errors="itemErrors(i)" localized />
          <MzSchemaFields v-if="props.type.item_settings_schema" v-model="item.settings" :root="props.type.item_settings_schema" :path="`${props.path}/${i}/settings`" :errors="itemErrors(i)" />
          <MzPeriodField v-model="item.active_period" />
        </div>
      </li>
    </ol>
  </section>
</template>
