<script setup lang="ts">
import type { BlockDraft, FieldError, SchemaNode, SectionType } from '~/utils/page-types'
import { resolveNode } from '~/utils/page-builder'

/**
 * Right panel: the selected section's form, built from its type's schemas and grouped in tabs
 * (Content, Layout, Source, Advanced), plus Display (devices, languages, schedule, anchor, look).
 * A placement of a shared section is read-only here: it is edited in the library (every page
 * that shows it changes).
 */
const props = defineProps<{ type: SectionType, index: number, errors: FieldError[], appearanceSchema: SchemaNode }>()
const block = defineModel<BlockDraft>({ required: true })
const emit = defineEmits<{ editShared: [id: string] }>()
const { t, locales } = useI18n()
const path = computed(() => `/blocks/${props.index}`)

const groupsOf = (root: SchemaNode | null) =>
  Object.values(resolveNode(root ?? {}, root ?? {}).properties ?? {}).map(n => (resolveNode(root!, n)['x-group'] ?? 'content') as string)
const groups = computed(() => {
  const all = new Set([...groupsOf(props.type.content_schema), ...groupsOf(props.type.settings_schema)])
  return ['content', 'source', 'layout', 'advanced'].filter(g => all.has(g))
})
const tabs = computed(() => [...groups.value.map(g => ({ label: t(`admin.builder.groups.${g}`), value: g })), { label: t('admin.builder.groups.display'), value: 'display' }])
const tab = ref('content')
watch(() => block.value.id, () => (tab.value = groups.value[0] ?? 'display'))

const contentHas = (group: string) => groupsOf(props.type.content_schema).includes(group)
const devices = computed(() => ['all', 'desktop', 'mobile'].map(v => ({ label: t(`admin.builder.devices.${v}`), value: v })))
const languageItems = computed(() => locales.value.map(l => ({ label: l.name ?? l.code, value: String(l.code) })))
const errorsAt = (p: string) => props.errors.filter(e => e.path === p || e.path.startsWith(`${p}/`))
const topErrors = computed(() => props.errors.filter(e => ['', '/type', '/id', '/shared_block_id'].includes(e.path.slice(path.value.length))))
</script>

<template>
  <div class="flex flex-col gap-6" :data-testid="`section-form-${block.type}`">
    <div class="flex items-start gap-3">
      <UIcon :name="props.type.icon ?? 'i-lucide-square'" class="mt-1 size-5 text-primary" aria-hidden="true" />
      <div class="flex-1">
        <p class="text-small text-muted">{{ props.type.name }}</p>
        <UInput :model-value="block.name ?? ''" :placeholder="t('admin.builder.namePlaceholder')" variant="ghost" class="-ms-2 w-full font-medium" :aria-label="t('admin.builder.rename')" @update:model-value="v => (block.name = v ? String(v) : null)" />
      </div>
    </div>
    <UAlert v-for="e in topErrors" :key="e.path + e.code" color="error" variant="subtle" :title="e.message" icon="i-lucide-circle-alert" />

    <template v-if="block.shared_block_id">
      <UAlert color="info" variant="subtle" icon="i-lucide-link" :title="t('admin.builder.shared.placementTitle')" :description="t('admin.builder.shared.placementText')" />
      <UButton :label="t('admin.builder.shared.edit')" icon="i-lucide-pencil" color="neutral" variant="outline" class="self-start" @click="emit('editShared', block.shared_block_id)" />
    </template>

    <UTabs v-model="tab" :items="tabs" variant="link" :content="false" class="w-full" />

    <template v-if="!block.shared_block_id && tab !== 'display'">
      <MzSchemaFields v-if="contentHas(tab)" v-model="block.content" :root="props.type.content_schema" :group="tab" :path="`${path}/content`" :errors="errorsAt(`${path}/content`)" localized />
      <MzSchemaFields v-model="block.settings" :root="props.type.settings_schema" :group="tab" :path="`${path}/settings`" :errors="errorsAt(`${path}/settings`)" />
      <MzBuilderItems v-if="tab === 'content' && (props.type.item_settings_schema || props.type.item_content_schema)" v-model="block" :type="props.type" :path="`${path}/items`" :errors="errorsAt(`${path}/items`)" />
    </template>

    <div v-if="tab === 'display'" class="flex flex-col gap-6">
      <UFormField :label="t('admin.builder.display.devices')">
        <URadioGroup v-model="block.visible_on" :items="devices" orientation="horizontal" />
      </UFormField>
      <UFormField :label="t('admin.builder.display.hiddenLocales')" :error="errorsAt(`${path}/hidden_locales`)[0]?.message">
        <USelectMenu v-model="block.hidden_locales" :items="languageItems" value-key="value" multiple class="w-full" />
      </UFormField>
      <MzPeriodField v-model="block.active_period" />
      <UFormField :label="t('admin.builder.display.anchor')" :hint="t('admin.builder.display.anchorHint')" :error="errorsAt(`${path}/anchor_id`)[0]?.message">
        <UInput :model-value="block.anchor_id ?? ''" placeholder="farm" class="w-full" @update:model-value="v => (block.anchor_id = v ? String(v).toLowerCase() : null)" />
      </UFormField>
      <template v-if="!block.shared_block_id">
        <h3 class="text-small font-medium">{{ t('admin.builder.display.appearance') }}</h3>
        <MzSchemaFields v-model="block.appearance" :root="props.appearanceSchema" :path="`${path}/appearance`" :errors="errorsAt(`${path}/appearance`)" />
      </template>
      <UFormField :label="t('admin.builder.display.analytics')">
        <UInput :model-value="block.analytics_label ?? ''" class="w-full" @update:model-value="v => (block.analytics_label = v ? String(v) : null)" />
      </UFormField>
    </div>
  </div>
</template>
