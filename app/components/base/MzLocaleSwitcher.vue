<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

/** Language switch: each language named in itself, with its own `lang`, keeping the page. */
const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
  /** `route`: go to the same page in the other language (public site). `state`: switch the
   *  language in place, for pages without localized URLs (admin). */
  mode?: 'route' | 'state'
  /** `text`: just the language code (editorial header); `icon`: with the languages icon. */
  variant?: 'icon' | 'text'
}>(), { size: undefined, showLabel: true, mode: 'route', variant: 'icon' })

const { t, locale, locales, setLocale } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const { size: densitySize } = useDensity()
// Admin choice, kept apart from i18n's own cookie (rewritten from the URL on every load).
const adminLocale = useCookie<string | null>(ADMIN_LOCALE_COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
async function choose(code: string) {
  adminLocale.value = code
  await setLocale(code as typeof locale.value)
}

const current = computed(() => locales.value.find(l => l.code === locale.value))
// Plain items (a `checkbox` item ignores its link: choosing a language did nothing); the current
// one is marked with a check icon and `aria-current`.
const items = computed<DropdownMenuItem[]>(() =>
  locales.value.map(l => ({
    label: l.name ?? l.code,
    // `locale: false`: the path is already localized. Nuxt UI's link otherwise prefixes any path
    // without a locale with the current one, so French (unprefixed) became `/en/…` from English.
    ...(props.mode === 'route'
      ? { to: switchLocalePath(l.code), locale: false }
      : { onSelect: () => choose(l.code) }),
    trailingIcon: l.code === locale.value ? 'i-lucide-check' : undefined,
    'aria-current': l.code === locale.value ? 'true' : undefined,
    lang: l.language ?? l.code,
    'data-testid': `locale-${l.code}`,
  })),
)
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      :icon="props.variant === 'icon' ? 'i-lucide-languages' : undefined"
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
