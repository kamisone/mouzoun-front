<script setup lang="ts">
import type { ResolvedLink } from '~/utils/page-types'

/**
 * A link: page, product, category, place (picked), a site route (/stays), an external URL
 * (https, mailto, tel) or an anchor of this page; opens in a new tab or not. `withStyle`: a
 * button (link + style); "No button" clears it.
 */
const props = withDefaults(defineProps<{ withStyle?: boolean }>(), { withStyle: false })
// A link, or `{ link, style }` with `withStyle`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = defineModel<any>()
const { t } = useI18n()
const link = computed<ResolvedLink | undefined>(() => (props.withStyle ? model.value?.link : model.value))
const types = ['page', 'product', 'category', 'place', 'route', 'url', 'anchor'] as const
const typeItems = computed(() => [
  { label: t('admin.builder.link.none'), value: 'none' },
  ...types.map(v => ({ label: t(`admin.builder.link.types.${v}`), value: v })),
])
const styles = ['primary', 'secondary', 'ghost', 'link'].map(v => ({ label: t(`admin.builder.values.${v}`, v), value: v }))

function setLink(next: ResolvedLink | undefined) {
  if (props.withStyle) model.value = next ? { style: model.value?.style ?? 'primary', ...(model.value ?? {}), link: next } : undefined
  else model.value = next
}
function setType(type: string) {
  if (type === 'none') return setLink(undefined)
  setLink({ type: type as ResolvedLink['type'], new_tab: link.value?.new_tab ?? false })
}
function patch(values: Partial<ResolvedLink>) {
  if (!link.value) return
  const { href: _h, external: _e, ...rest } = link.value
  setLink({ ...rest, ...values })
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-sm border border-default p-3">
    <div class="grid grid-cols-2 gap-2">
      <USelect :model-value="link?.type ?? 'none'" :items="typeItems" :aria-label="t('admin.builder.link.type')" @update:model-value="v => setType(String(v))" />
      <USelect v-if="props.withStyle && link" :model-value="model?.style ?? 'primary'" :items="styles" :aria-label="t('admin.builder.link.style')" @update:model-value="(v: string) => (model = { ...model, style: v })" />
    </div>
    <template v-if="link">
      <MzEntityPicker v-if="['page', 'product', 'category', 'place'].includes(link!.type)" :kind="link!.type" :model-value="link!.id" :label="t(`admin.builder.link!.types.${link!.type}`)" @update:model-value="v => patch({ id: v as string })" />
      <UInput v-else-if="link!.type === 'route'" :model-value="link!.route ?? ''" placeholder="/stays" :aria-label="t('admin.builder.link!.types.route')" @update:model-value="(v: string) => patch({ route: v })" />
      <UInput v-else-if="link!.type === 'url'" :model-value="link!.url ?? ''" placeholder="https://" type="url" :aria-label="t('admin.builder.link!.types.url')" @update:model-value="(v: string) => patch({ url: v })" />
      <UInput v-else-if="link!.type === 'anchor'" :model-value="link!.anchor ?? ''" placeholder="farm" :aria-label="t('admin.builder.link!.types.anchor')" @update:model-value="(v: string) => patch({ anchor: v })" />
      <UCheckbox :model-value="!!link!.new_tab" :label="t('admin.builder.link.newTab')" @update:model-value="v => patch({ new_tab: !!v })" />
    </template>
  </div>
</template>
