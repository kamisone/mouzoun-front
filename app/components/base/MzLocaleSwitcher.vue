<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

/** Language switch: each language named in itself, with its own `lang`, keeping the page. */
const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
  /** `route`: go to the same page in the other language (public site). `state`: switch the
   *  language in place, for pages without localized URLs (admin). */
  mode?: 'route' | 'state'
}>(), { size: undefined, showLabel: true, mode: 'route' })

const { t, locale, locales, setLocale } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const { size: densitySize } = useDensity()

const current = computed(() => locales.value.find(l => l.code === locale.value))
const items = computed<DropdownMenuItem[]>(() =>
  locales.value.map(l => ({
    label: l.name ?? l.code,
    ...(props.mode === 'route'
      ? { to: switchLocalePath(l.code) }
      : { onSelect: () => setLocale(l.code) }),
    type: 'checkbox' as const,
    checked: l.code === locale.value,
    lang: l.language ?? l.code,
  })),
)
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-languages"
      color="neutral"
      variant="ghost"
      :size="props.size ?? densitySize"
      :label="props.showLabel ? current?.code.toUpperCase() : undefined"
      :aria-label="props.showLabel ? `${current?.code.toUpperCase()} — ${t('locale.label')}: ${current?.name ?? locale}` : `${t('locale.label')}: ${current?.name ?? locale}`"
    />
    <!-- Screen readers pronounce each language name in its own language. -->
    <template #item-label="{ item }">
      <span :lang="(item as { lang?: string }).lang">{{ item.label }}</span>
    </template>
  </UDropdownMenu>
</template>
