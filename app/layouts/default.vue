<script setup lang="ts">
/** Public site layout: skip link, sticky header, main landmark, footer. Light by default. */
const { t } = useI18n()
const { applyDefault } = useThemePreference()
onMounted(() => applyDefault('light'))
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-(--z-toast) focus:rounded-md focus:bg-elevated focus:px-4 focus:py-2 focus:font-semibold focus:text-highlighted focus:shadow-lifted"
    >{{ t('a11y.skipToContent') }}</a>
    <MzSiteHeader />
    <main id="main" tabindex="-1" class="flex-1 focus:outline-none">
      <slot />
    </main>
    <MzSiteFooter />
  </div>
</template>
