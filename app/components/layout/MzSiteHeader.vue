<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

/** Public header: sticky, logo, main navigation, language, theme, "Book" call to action; on
 *  small screens the navigation moves into a drawer opening from the start side. */
const { t } = useI18n()
const localePath = useLocalePath()
const dir = useTextDirection({ selector: 'html' })
const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })

// Feature pages come later: the links point to the home page sections until then.
const items = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.stay'), to: `${localePath('/')}#stay` },
  { label: t('nav.activities'), to: `${localePath('/')}#activities` },
  { label: t('nav.farm'), to: `${localePath('/')}#farm` },
  { label: t('nav.village'), to: `${localePath('/')}#village` },
  { label: t('nav.contact'), to: '#contact' },
])
</script>

<template>
  <header class="sticky top-0 z-(--z-sticky) border-b border-default bg-default/90 backdrop-blur supports-[backdrop-filter]:bg-default/75">
    <MzContainer class="flex h-(--ui-header-height) items-center justify-between gap-4">
      <MzLogo />
      <nav :aria-label="t('nav.mainNavigation')" class="hidden lg:block">
        <UNavigationMenu :items="items" variant="link" />
      </nav>
      <div class="flex items-center gap-1">
        <MzLocaleSwitcher />
        <MzThemeToggle />
        <UButton :to="`${localePath('/')}#stay`" :label="t('common.book')" class="ms-2 hidden sm:inline-flex" />
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="lg:hidden"
          :aria-label="t('nav.openMenu')"
          :aria-expanded="open"
          aria-controls="mobile-menu"
          @click="open = true"
        />
      </div>
    </MzContainer>

    <USlideover v-model:open="open" :side="dir === 'rtl' ? 'right' : 'left'" :title="t('nav.menu')">
      <template #body>
        <nav id="mobile-menu" :aria-label="t('nav.mainNavigation')" class="flex flex-col gap-6">
          <UNavigationMenu :items="items" orientation="vertical" />
          <UButton :to="`${localePath('/')}#stay`" :label="t('common.book')" size="lg" block />
        </nav>
      </template>
    </USlideover>
  </header>
</template>
