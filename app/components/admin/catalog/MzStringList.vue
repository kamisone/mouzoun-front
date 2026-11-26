<script setup lang="ts">
/** A sortable list of short texts (highlights, included, what to bring...). */
const props = defineProps<{ label: string, placeholder?: string }>()
const model = defineModel<string[]>({ default: () => [] })
const { t } = useI18n()
const draft = ref('')
function add() {
  const v = draft.value.trim()
  if (!v) return
  model.value = [...model.value, v]
  draft.value = ''
}
function move(i: number, by: number) {
  const next = [...model.value]
  const j = i + by
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  model.value = next
}
function edit(i: number, v: string) {
  const next = [...model.value]
  next[i] = v
  model.value = next
}
</script>

<template>
  <div class="flex flex-col gap-2" role="group" :aria-label="props.label">
    <p class="text-small font-medium">{{ props.label }}</p>
    <ol v-if="model.length" class="flex flex-col gap-1">
      <li v-for="(item, i) in model" :key="i" class="flex items-center gap-1">
        <UInput :model-value="item" size="sm" class="flex-1" :aria-label="`${props.label} ${i + 1}`" @update:model-value="v => edit(i, String(v))" />
        <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, -1)" />
        <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === model.length - 1" :aria-label="t('admin.catalog.moveDown')" @click="move(i, 1)" />
        <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="model = model.filter((_, j) => j !== i)" />
      </li>
    </ol>
    <div class="flex gap-2">
      <UInput v-model="draft" size="sm" class="flex-1" :placeholder="props.placeholder ?? t('admin.catalog.addLine')" :aria-label="`${props.label} (${t('admin.catalog.addLine')})`" @keydown.enter.prevent="add" />
      <UButton icon="i-lucide-plus" size="sm" color="neutral" variant="outline" :aria-label="t('admin.catalog.addLine')" @click="add" />
    </div>
  </div>
</template>
