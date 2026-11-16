<script setup lang="ts">
import type { FieldError, Json, SchemaNode } from '~/utils/page-types'
import { resolveNode } from '~/utils/page-builder'

/**
 * Form generated from a JSON Schema object (`properties`), one field per property, filtered by
 * `x-group`. `localized`: the value is `{ fr: {...}, en: {...} }` (content) and every field gets a
 * tab per language with a "missing" marker; only the default language is required.
 * Server errors (`errors`, absolute JSON pointers) show under the field whose `path` they hit.
 */
const props = withDefaults(defineProps<{
  root: SchemaNode
  node?: SchemaNode
  group?: string
  /** JSON pointer of this object in the saved document (`/blocks/2/settings`). */
  path: string
  errors?: FieldError[]
  localized?: boolean
}>(), { node: undefined, group: undefined, errors: () => [], localized: false })

const model = defineModel<Json>({ required: true })
const { locales, t, te } = useI18n()
/** French and Arabic labels by field name; otherwise the schema's English title. */
const labelOf = (key: string, node: SchemaNode) => (te(`admin.builder.fields.${key}`) ? t(`admin.builder.fields.${key}`) : (node.title ?? key))
const defaultLocale = 'fr'
const activeLocale = inject<Ref<string>>('builder-locale', ref(defaultLocale))

const object = computed(() => resolveNode(props.root, props.node ?? props.root))
const required = computed(() => new Set(object.value.required ?? []))
const fields = computed(() =>
  Object.entries(object.value.properties ?? {})
    .map(([key, child]) => ({ key, node: resolveNode(props.root, child) }))
    .filter(f => !props.group || (f.node['x-group'] ?? 'content') === props.group),
)

function valueOf(key: string, locale?: string) {
  return locale ? model.value[locale]?.[key] : model.value[key]
}
function set(key: string, value: unknown, locale?: string) {
  if (locale) {
    const { [key]: _old, ...rest } = (model.value[locale] ?? {}) as Json
    const empty = value === '' || value === null || value === undefined
    model.value = { ...model.value, [locale]: empty ? rest : { ...rest, [key]: value } }
  }
  else {
    const { [key]: _old, ...rest } = model.value
    model.value = value === undefined ? rest : { ...rest, [key]: value }
  }
}
function missing(key: string, locale: string) {
  const v = valueOf(key, locale)
  return v === undefined || v === null || (typeof v === 'string' && !v.trim())
}
function errorsAt(pointer: string) {
  return props.errors.filter(e => e.path === pointer || e.path.startsWith(`${pointer}/`))
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <template v-for="f in fields" :key="f.key">
      <div v-if="props.localized" class="flex flex-col gap-2" :data-field="f.key">
        <div class="flex items-center justify-between gap-2">
          <span class="text-small font-medium">{{ labelOf(f.key, f.node) }}<span v-if="required.has(f.key)" class="text-error"> *</span></span>
          <div class="flex gap-1" role="tablist" :aria-label="labelOf(f.key, f.node)">
            <button
              v-for="l in locales"
              :key="l.code"
              type="button"
              role="tab"
              :aria-selected="activeLocale === l.code"
              class="relative rounded-xs px-2 py-1 text-caption font-medium uppercase"
              :class="activeLocale === l.code ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-muted'"
              :data-testid="`locale-tab-${f.key}-${l.code}`"
              @click="activeLocale = l.code"
            >
              {{ l.code }}
              <span v-if="missing(f.key, l.code)" class="absolute -end-1 -top-1 size-2 rounded-full" :class="l.code === defaultLocale && required.has(f.key) ? 'bg-error' : 'bg-warning'" :title="$t('admin.builder.missing')" />
            </button>
          </div>
        </div>
        <MzSchemaField
          :root="props.root"
          :node="f.node"
          :model-value="valueOf(f.key, activeLocale)"
          :path="`${props.path}/${activeLocale}/${f.key}`"
          :errors="errorsAt(`${props.path}/${activeLocale}/${f.key}`)"
          :dir="(locales.find(l => l.code === activeLocale)?.dir === 'rtl' ? 'rtl' : 'ltr')"
          :lang="activeLocale"
          hide-label
          :label="`${labelOf(f.key, f.node)} (${activeLocale.toUpperCase()})`"
          @update:model-value="v => set(f.key, v, activeLocale)"
        />
      </div>
      <MzSchemaField
        v-else
        :root="props.root"
        :node="f.node"
        :model-value="valueOf(f.key)"
        :path="`${props.path}/${f.key}`"
        :errors="errorsAt(`${props.path}/${f.key}`)"
        :label="labelOf(f.key, f.node)"
        :required="required.has(f.key)"
        :data-field="f.key"
        @update:model-value="v => set(f.key, v)"
      />
    </template>
  </div>
</template>
