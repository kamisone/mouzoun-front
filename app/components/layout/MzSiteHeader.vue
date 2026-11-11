<script setup lang="ts">
/**
 * Public header. Over a hero (page meta `headerOverlay: true`) it starts transparent with ivory
 * text and becomes solid ivory with a hairline once the page scrolls (300 ms). Centred wordmark,
 * few navigation items, language, theme, "Book". Mobile: full-screen menu with large serif links.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { y } = useWindowScroll()
const open = ref(false)
watch(() => route.fullPath, () => { open.value = false })

const overlay = computed(() => route.meta.headerOverlay === true)
const scrolled = computed(() => y.value > 16)
const transparent = computed(() => overlay.value && !scrolled.value && !open.value)

// Feature pages come later: until then the links point to sections of the home page.
const home = computed(() => localePath('/'))
const items = computed(() => [
  { label: t('nav.stay'), to: `${home.value}#stay` },
  { label: t('nav.activities'), to: `${home.value}#experiences` },
  { label: t('nav.farm'), to: `${home.value}#farm` },
  { label: t('nav.practical'), to: `${home.value}#practical` },
])
</script>

<template>
  <header
    class="inset-x-0 top-0 z-(--z-sticky) transition-[background-color,border-color] duration-(--duration-header) ease-(--ease-editorial)"
    :class="[
      overlay ? 'fixed' : 'sticky',
      transparent ? 'dark border-b border-transparent bg-transparent' : 'border-b border-default bg-default',
    ]"
  >
    <MzContainer class="grid h-(--ui-header-height) grid-cols-[1fr_auto_1fr] items-center gap-4">
      <!-- Start: navigation (desktop) or menu button (mobile) -->
      <div class="flex items-center">
        <nav :aria-label="t('nav.mainNavigation')" class="hidden lg:block">
          <ul class="flex items-center gap-8">
            <li v-for="item in items" :key="item.to">
              <NuxtLink :to="item.to" class="text-small font-medium tracking-button text-highlighted transition-opacity hover:opacity-70">{{ item.label }}</NuxtLink>
            </li>
          </ul>
        </nav>
        <UButton
          :label="t('nav.menu')"
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="-ms-4 lg:hidden"
          :aria-expanded="open"
          aria-controls="mobile-menu"
          @click="open = true"
        />
      </div>

      <MzLogo />

      <!-- End: language, theme, book -->
      <div class="flex items-center justify-end gap-1">
        <MzLocaleSwitcher variant="text" class="hidden sm:inline-flex" />
        <MzThemeToggle class="hidden sm:inline-flex" />
        <UButton
          :to="`${home}#book`"
          :label="t('common.book')"
          :color="transparent ? 'neutral' : 'primary'"
          :variant="transparent ? 'outline' : 'solid'"
          class="ms-4 hidden md:inline-flex"
        />
      </div>
    </MzContainer>

    <UModal v-model:open="open" fullscreen :title="t('nav.menu')" :ui="{ content: 'bg-default', header: 'h-(--ui-header-height) px-6', body: 'flex flex-col justify-between px-6 pb-12' }">
      <template #body>
        <nav id="mobile-menu" :aria-label="t('nav.mainNavigation')">
          <ul class="flex flex-col gap-4 pt-8">
            <li v-for="item in items" :key="item.to">
              <NuxtLink :to="item.to" class="font-display text-h1 text-highlighted" @click="open = false">{{ item.label }}</NuxtLink>
            </li>
          </ul>
        </nav>
        <div class="flex flex-col gap-6 pt-12">
          <div class="flex items-center gap-2">
            <MzLocaleSwitcher variant="text" />
            <MzThemeToggle />
          </div>
          <UButton :to="`${home}#book`" :label="t('common.book')" size="lg" block @click="open = false" />
        </div>
      </template>
    </UModal>
  </header>
</template>
