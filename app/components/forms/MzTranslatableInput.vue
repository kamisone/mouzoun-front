<script setup lang="ts">
/**
 * One text in every language (FR / EN / AR tabs), v-model `{ fr, en, ar }` — the shape of
 * `x_translations` in the API. The Arabic field is right-to-left; tabs show missing languages.
 */
type Values = Partial<Record<string, string>>

const props = withDefaults(defineProps<{
  label?: string
  multiline?: boolean
  rows?: number
  /** Languages that must be filled (others may fall back to French). */
  requiredLocales?: string[]
  placeholder?: string
  disabled?: boolean
}>(), { label: undefined, multiline: false, rows: 4, requiredLocales: () => ['fr'], placeholder: undefined, disabled: false })

const model = defineModel<Values>({ default: () => ({}) })
const { t, locales } = useI18n()
const { size } = useDensity()
const active = ref<string>('fr')
const uid = useId()

const tabs = computed(() =>
  locales.value.map(l => ({
    value: l.code,
    label: l.code.toUpperCase(),
    missing: !model.value[l.code]?.trim(),
    required: props.requiredLocales.includes(l.code),
    dir: (l.dir ?? 'ltr') as 'ltr' | 'rtl',
    lang: l.language ?? l.code,
    name: l.name ?? l.code,
  })),
)

function update(code: string, value: string | number) {
  model.value = { ...model.value, [code]: String(value) }
}
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="mz-translatable-input">
    <UTabs
      v-model="active"
      :items="tabs.map(tab => ({ value: tab.value, label: tab.label, slot: 'item' as const }))"
      :content="false"
      variant="link"
      :size="size"
      :aria-label="props.label ?? t('forms.translations')"
    >
      <template #trailing="{ item }">
        <span
          v-if="tabs.find(tab => tab.value === item.value)?.missing"
          class="size-1.5 rounded-full"
          :class="tabs.find(tab => tab.value === item.value)?.required ? 'bg-error' : 'bg-warning'"
          :title="t('forms.missingTranslation')"
        >
          <span class="sr-only">{{ t('forms.missingTranslation') }}</span>
        </span>
      </template>
    </UTabs>
    <template v-for="tab in tabs" :key="tab.value">
      <div v-show="active === tab.value">
        <UTextarea
          v-if="props.multiline"
          :id="`${uid}-${tab.value}`"
          :model-value="model[tab.value] ?? ''"
          :rows="props.rows"
          :dir="tab.dir"
          :lang="tab.lang"
          :placeholder="props.placeholder"
          :disabled="props.disabled"
          :size="size"
          :aria-label="`${props.label ?? t('forms.translations')} (${tab.name})`"
          :required="tab.required"
          class="w-full"
          autoresize
          @update:model-value="v => update(tab.value, v)"
        />
        <UInput
          v-else
          :id="`${uid}-${tab.value}`"
          :model-value="model[tab.value] ?? ''"
          :dir="tab.dir"
          :lang="tab.lang"
          :placeholder="props.placeholder"
          :disabled="props.disabled"
          :size="size"
          :aria-label="`${props.label ?? t('forms.translations')} (${tab.name})`"
          :required="tab.required"
          class="w-full"
          @update:model-value="v => update(tab.value, v)"
        />
      </div>
    </template>
  </div>
</template>
