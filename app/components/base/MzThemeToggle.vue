<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ThemeChoice } from '~/composables/useThemePreference'

/** Light / dark / system switch. Remembers the choice; renders a stable icon until hydrated. */
const props = withDefaults(defineProps<{ size?: 'xs' | 'sm' | 'md' | 'lg' }>(), { size: undefined })

const { t } = useI18n()
const { preference } = useThemePreference()
const { size: densitySize } = useDensity()

const icons: Record<ThemeChoice, string> = {
  light: 'i-lucide-sun',
  dark: 'i-lucide-moon',
  system: 'i-lucide-monitor',
}

const items = computed<DropdownMenuItem[]>(() =>
  (['light', 'dark', 'system'] as const).map(choice => ({
    label: t(`theme.${choice}`),
    icon: icons[choice],
    type: 'checkbox' as const,
    checked: preference.value === choice,
    onUpdateChecked: () => { preference.value = choice },
  })),
)
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <ClientOnly>
      <UButton
        :icon="icons[preference]"
        color="neutral"
        variant="ghost"
        :size="props.size ?? densitySize"
        :aria-label="`${t('theme.label')}: ${t(`theme.${preference}`)}`"
        data-testid="theme-toggle"
      />
      <template #fallback>
        <UButton icon="i-lucide-sun-moon" color="neutral" variant="ghost" :size="props.size ?? densitySize" :aria-label="t('theme.label')" disabled />
      </template>
    </ClientOnly>
  </UDropdownMenu>
</template>
