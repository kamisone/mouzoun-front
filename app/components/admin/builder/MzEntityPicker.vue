<script setup lang="ts">
import type { LookupOption } from '~/utils/page-types'

/** Searchable picker of products, categories, places, FAQs, promotions, galleries or pages (one or several). */
const props = withDefaults(defineProps<{
  kind: string
  multiple?: boolean
  label: string
  /** Product kinds allowed (`x-kinds`), category scope allowed (`x-scope`). */
  kinds?: string[]
  scope?: string
}>(), { multiple: false, kinds: undefined, scope: undefined })
const { t } = useI18n()
const { money } = useMoney()
const model = defineModel<string | string[] | undefined>()
const api = useAdminApi()
const search = ref('')
const options = ref<LookupOption[]>([])
const known = ref<Record<string, LookupOption>>({})
const loading = ref(false)

const ids = computed(() => (Array.isArray(model.value) ? model.value : model.value ? [model.value] : []))

async function find(q: string) {
  loading.value = true
  try {
    options.value = (await api.lookup(props.kind, { q, kinds: props.kinds, scope: props.scope })).options
    for (const o of options.value) known.value[o.id] = o
  }
  catch {
    options.value = []
  }
  finally {
    loading.value = false
  }
}
watchDebounced(search, q => find(q), { debounce: 250 })
onMounted(async () => {
  await find('')
  const unknown = ids.value.filter(id => !known.value[id])
  if (!unknown.length) return
  const found = await api.lookup(props.kind, { ids: unknown, kinds: props.kinds, scope: props.scope }).catch(() => ({ options: [] }))
  for (const o of found.options) known.value[o.id] = o
})
const items = computed(() => {
  const all = new Map<string, LookupOption>()
  for (const id of ids.value) if (known.value[id]) all.set(id, known.value[id]!)
  for (const o of options.value) all.set(o.id, o)
  return [...all.values()].map(o => ({
    label: o.label,
    value: o.id,
    description: o.price_minor != null || o.availability
      ? [o.price_minor != null ? money(o.price_minor) : null, o.availability ? t(`shop.availability.${o.availability === 'low_stock' ? 'low_stock_generic' : o.availability}`) : null].filter(Boolean).join(' · ')
      : (o.hint ?? undefined),
    avatar: o.image_url ? { src: o.image_url, alt: '' } : undefined,
  }))
})
function remove(id: string) {
  model.value = props.multiple ? ids.value.filter(x => x !== id) : undefined
}
function moveUp(i: number) {
  if (i === 0) return
  const next = [...ids.value]
  ;[next[i - 1], next[i]] = [next[i]!, next[i - 1]!]
  model.value = next
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <USelectMenu
      v-model:search-term="search"
      :model-value="props.multiple ? ids : (ids[0] ?? undefined)"
      :items="items"
      value-key="value"
      :multiple="props.multiple"
      :loading="loading"
      ignore-filter
      class="w-full"
      :aria-label="props.label"
      :data-testid="`picker-${props.kind}`"
      @update:model-value="v => (model = props.multiple ? (v as string[]) : ((v as string) || undefined))"
    />
    <ol v-if="props.multiple && ids.length" class="flex flex-col gap-1 text-small">
      <li v-for="(id, i) in ids" :key="id" class="flex items-center gap-2 rounded-xs bg-muted px-2 py-1">
        <span class="flex-1 truncate">{{ known[id]?.label ?? id }}</span>
        <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="$t('admin.builder.moveUp')" @click="moveUp(i)" />
        <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="$t('common.delete')" @click="remove(id)" />
      </li>
    </ol>
  </div>
</template>
