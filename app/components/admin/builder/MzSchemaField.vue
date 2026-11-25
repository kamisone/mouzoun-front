<script setup lang="ts">
import type { FieldError, SchemaNode } from '~/utils/page-types'
import { resolveNode } from '~/utils/page-builder'

/**
 * One field of the generated form, chosen by `x-widget` (else by JSON type): text, textarea,
 * richtext, html, number, toggle, select (multi for arrays), color_scheme, icon, media,
 * media_list, link, cta, the entity pickers, datetime, and nested objects (sources).
 */
const props = withDefaults(defineProps<{
  root: SchemaNode
  node: SchemaNode
  path: string
  label: string
  errors?: FieldError[]
  required?: boolean
  hideLabel?: boolean
  dir?: 'ltr' | 'rtl'
  lang?: string
}>(), { errors: () => [], required: false, hideLabel: false, dir: 'ltr', lang: undefined })

// Any JSON value: its shape is given by the schema node.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = defineModel<any>()
const { t } = useI18n()
const n = computed(() => resolveNode(props.root, props.node))
const widget = computed(() => {
  const w = n.value['x-widget']
  if (w) return w
  const type = Array.isArray(n.value.type) ? n.value.type[0] : n.value.type
  if (n.value.enum) return 'select'
  if (type === 'boolean') return 'toggle'
  if (type === 'integer' || type === 'number') return 'number'
  if (type === 'object') return 'object'
  return 'text'
})
const isArray = computed(() => n.value.type === 'array')
const enumValues = computed(() => (isArray.value ? resolveNode(props.root, n.value.items ?? {}).enum : n.value.enum) ?? [])
const options = computed(() => enumValues.value.map(v => ({ label: t(`admin.builder.values.${v}`, String(v)), value: v })))
const pickers: Record<string, string> = {
  product_picker: 'product', category_picker: 'category', place_picker: 'place', faq_picker: 'faq',
  promotion_picker: 'promotion', gallery_picker: 'gallery',
}
/** `x-kinds` (product kinds) and `x-scope` (category scope) restrict what a picker lists. */
const pickerKinds = computed(() => n.value['x-kinds'] as string[] | undefined)
const pickerScope = computed(() => n.value['x-scope'] as string | undefined)
const ownError = computed(() => props.errors.find(e => e.path === props.path)?.message ?? props.errors[0]?.message)
const schemes = ['light', 'dark', 'sand', 'night', 'brand'] as const

function num(v: string | number) {
  if (v === '' || v === null) return undefined
  const x = Number(v)
  return Number.isNaN(x) ? undefined : x
}
</script>

<template>
  <!-- Nested object without a dedicated widget (e.g. a source rule): its own fields. -->
  <fieldset v-if="widget === 'object' || widget === 'source'" class="flex flex-col gap-4 rounded-sm border border-default p-4" :data-path="props.path">
    <legend class="px-1 text-small font-medium">{{ props.label }}</legend>
    <template v-if="widget === 'source'">
      <URadioGroup
        :model-value="model?.mode ?? 'rule'"
        orientation="horizontal"
        :items="[{ label: t('admin.builder.source.rule'), value: 'rule' }, { label: t('admin.builder.source.manual'), value: 'manual' }]"
        @update:model-value="v => (model = { ids: [], ...(model ?? {}), mode: v })"
      />
      <MzSchemaField
        v-if="(model?.mode ?? 'rule') === 'manual'"
        :root="props.root"
        :node="n.properties!.ids!"
        :model-value="model?.ids ?? []"
        :path="`${props.path}/ids`"
        :errors="props.errors.filter(e => e.path.startsWith(`${props.path}/ids`))"
        :label="n.properties!.ids!.title ?? 'ids'"
        @update:model-value="v => (model = { ...(model ?? {}), ids: v })"
      />
      <MzSchemaFields
        v-else
        :root="props.root"
        :node="n.properties!.rule!"
        :model-value="model?.rule ?? {}"
        :path="`${props.path}/rule`"
        :errors="props.errors"
        @update:model-value="v => (model = { ...(model ?? {}), rule: v })"
      />
    </template>
    <MzSchemaFields v-else :root="props.root" :node="n" :model-value="model ?? {}" :path="props.path" :errors="props.errors" @update:model-value="v => (model = v)" />
    <p v-if="ownError && widget === 'source'" class="text-small text-error">{{ ownError }}</p>
  </fieldset>

  <UFormField v-else :label="props.hideLabel ? undefined : props.label" :required="props.required" :error="ownError" :data-path="props.path" :ui="{ label: props.hideLabel ? 'sr-only' : undefined }">
    <UInput
      v-if="widget === 'text'"
      :model-value="model ?? ''"
      :maxlength="n.maxLength"
      :dir="props.dir"
      :lang="props.lang"
      :aria-label="props.label"
      class="w-full"
      @update:model-value="v => (model = v === '' ? undefined : v)"
    />
    <UTextarea
      v-else-if="widget === 'textarea'"
      :model-value="model ?? ''"
      :maxlength="n.maxLength"
      :rows="3"
      autoresize
      :dir="props.dir"
      :lang="props.lang"
      :aria-label="props.label"
      class="w-full"
      @update:model-value="v => (model = v === '' ? undefined : v)"
    />
    <MzRichTextField v-else-if="widget === 'richtext'" v-model="model" :dir="props.dir" :lang="props.lang" :label="props.label" />
    <UTextarea v-else-if="widget === 'html'" :model-value="model ?? ''" :rows="10" class="w-full font-mono" :aria-label="props.label" dir="ltr" @update:model-value="v => (model = v)" />
    <UInput
      v-else-if="widget === 'number'"
      type="number"
      :model-value="model ?? ''"
      :min="n.minimum"
      :max="n.maximum"
      :step="n.type === 'integer' ? 1 : 'any'"
      :aria-label="props.label"
      class="w-40"
      @update:model-value="v => (model = num(v))"
    />
    <USwitch v-else-if="widget === 'toggle'" :model-value="model ?? (n.default as boolean) ?? false" :aria-label="props.label" @update:model-value="v => (model = v)" />
    <USelectMenu
      v-else-if="widget === 'select' && isArray"
      :model-value="model ?? []"
      :items="options"
      value-key="value"
      multiple
      class="w-full"
      :aria-label="props.label"
      @update:model-value="v => (model = v)"
    />
    <USelect
      v-else-if="widget === 'select'"
      :model-value="model ?? n.default"
      :items="options"
      class="w-full"
      :aria-label="props.label"
      @update:model-value="v => (model = v)"
    />
    <div v-else-if="widget === 'color_scheme'" class="flex flex-wrap gap-2" role="radiogroup" :aria-label="props.label">
      <button
        v-for="s in schemes"
        :key="s"
        type="button"
        role="radio"
        :aria-checked="(model ?? 'light') === s"
        class="flex items-center gap-2 rounded-sm border px-3 py-2 text-small"
        :class="(model ?? 'light') === s ? 'border-primary ring-1 ring-primary' : 'border-default'"
        @click="model = s"
      >
        <span class="size-4 rounded-full border border-default" :class="{ light: 'light bg-default', dark: 'dark bg-elevated', sand: 'light bg-muted', night: 'dark bg-default', brand: 'bg-primary' }[s]" />
        {{ t(`admin.builder.values.${s}`, s) }}
      </button>
    </div>
    <div v-else-if="widget === 'icon'" class="flex items-center gap-3">
      <span class="flex size-9 items-center justify-center rounded-sm border border-default">
        <UIcon v-if="model" :name="model" class="size-5" />
      </span>
      <UInput :model-value="model ?? ''" placeholder="i-lucide-coffee" class="flex-1" :aria-label="props.label" @update:model-value="v => (model = v || undefined)" />
    </div>
    <MzMediaField v-else-if="widget === 'media'" v-model="model" :kinds="n['x-media-kinds']" :label="props.label" />
    <MzMediaField v-else-if="widget === 'media_list'" v-model="model" multiple :kinds="n['x-media-kinds']" :label="props.label" />
    <MzLinkField v-else-if="widget === 'link'" v-model="model" />
    <MzLinkField v-else-if="widget === 'cta'" v-model="model" with-style />
    <MzEntityPicker v-else-if="pickers[widget]" v-model="model" :kind="pickers[widget]!" :multiple="isArray" :label="props.label" :kinds="pickerKinds" :scope="pickerScope" />
    <MzDateTimeField v-else-if="widget === 'datetime'" v-model="model" :label="props.label" />
    <UInput v-else :model-value="model ?? ''" class="w-full" :aria-label="props.label" @update:model-value="v => (model = v)" />
  </UFormField>
</template>
