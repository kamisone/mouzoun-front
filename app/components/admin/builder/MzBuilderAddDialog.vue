<script setup lang="ts">
import type { SectionType, SharedSummary } from '~/utils/page-types'
import type { Builder } from '~/composables/useBuilder'

/**
 * "Add section": the active types grouped by category, with their preview image; a type is
 * disabled when the page already has its maximum, the page type does not allow it, or the user
 * lacks its permission. The "Shared sections" tab inserts a placement of a library section.
 */
const props = defineProps<{ builder: Builder, position: number, pageType: string }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const api = useAdminApi()
const b = props.builder
const tab = ref('types')
const shared = ref<SharedSummary[]>([])
const search = ref('')
watch(open, async (o) => {
  if (o) shared.value = (await api.shared.list()).sections
})

const categories = ['hero', 'listing', 'content', 'media', 'social_proof', 'conversion', 'layout', 'utility'] as const
function reason(type: SectionType): string | null {
  if (!type.is_active) return t('admin.builder.addDialog.inactive')
  if (type.required_permission && !(type.required_permission === 'content.html' && b.canUseHtml.value)) return t('admin.builder.addDialog.permission')
  if (type.allowed_page_types && !type.allowed_page_types.includes(props.pageType)) return t('admin.builder.addDialog.pageType')
  const count = b.blocks.value.filter(x => x.type === type.code).length
  if (type.max_per_page && count >= type.max_per_page) return t('admin.builder.addDialog.max', { n: type.max_per_page })
  if (type.renders_h1 && b.blocks.value.some(x => b.typeOf(x.type)?.renders_h1)) return t('admin.builder.addDialog.h1')
  return null
}
const grouped = computed(() =>
  categories
    .map(c => ({ category: c, types: b.types.value.filter(x => x.category === c && (!search.value || `${x.name} ${x.description}`.toLowerCase().includes(search.value.toLowerCase()))) }))
    .filter(g => g.types.length),
)
function pick(type: SectionType) {
  if (reason(type)) return
  b.add(type, props.position)
  open.value = false
}
async function pickShared(s: SharedSummary) {
  const block = await api.shared.get(s.id)
  b.addShared(block, props.position)
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="t('admin.builder.addDialog.title')" :ui="{ content: 'max-w-4xl' }">
    <template #body>
      <UTabs v-model="tab" :items="[{ label: t('admin.builder.addDialog.types'), value: 'types' }, { label: t('admin.builder.addDialog.shared'), value: 'shared' }]" variant="link" :content="false" class="mb-4" />
      <template v-if="tab === 'types'">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('common.search')" class="mb-6 w-full" autofocus />
        <section v-for="g in grouped" :key="g.category" class="mb-8">
          <h3 class="mb-3 text-small font-medium text-muted">{{ t(`admin.builder.categories.${g.category}`) }}</h3>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="type in g.types" :key="type.code">
              <button
                type="button"
                class="flex h-full w-full flex-col gap-2 rounded-sm border border-default p-3 text-start hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!!reason(type)"
                :data-testid="`add-type-${type.code}`"
                @click="pick(type)"
              >
                <img v-if="type.preview_url" :src="type.preview_url" alt="" class="aspect-video w-full rounded-xs object-cover" loading="lazy">
                <span class="flex items-center gap-2 font-medium"><UIcon :name="type.icon ?? 'i-lucide-square'" class="size-4 text-primary" aria-hidden="true" />{{ type.name }}</span>
                <span class="text-small text-muted">{{ type.description }}</span>
                <span v-if="reason(type)" class="text-caption text-warning">{{ reason(type) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>
      <template v-else>
        <MzEmptyState v-if="!shared.length" icon="i-lucide-link" :title="t('admin.builder.addDialog.noShared')" :description="t('admin.builder.addDialog.noSharedText')" />
        <ul class="flex flex-col gap-2">
          <li v-for="s in shared" :key="s.id">
            <button type="button" class="flex w-full items-center gap-3 rounded-sm border border-default p-3 text-start hover:border-primary" @click="pickShared(s)">
              <UIcon :name="b.typeOf(s.type)?.icon ?? 'i-lucide-square'" class="size-5 text-primary" aria-hidden="true" />
              <span class="flex-1">{{ s.name ?? b.typeOf(s.type)?.name }}</span>
              <span class="text-caption text-muted">{{ t('admin.builder.addDialog.usedOn', { n: s.usages }) }}</span>
            </button>
          </li>
        </ul>
      </template>
    </template>
  </UModal>
</template>
