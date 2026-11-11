<script setup lang="ts">
/** Sign-in pages: one calm card over a full-bleed desert photograph (scrim for legibility). */
const { t } = useI18n()
const { photo } = usePhoto()
const { site } = useAppConfig()
const background = computed(() => (site.authBackground ? { src: site.authBackground, srcset: undefined, lqip: undefined } : photo('sunset-ripples')))
const { applyDefault } = useThemePreference()
onMounted(() => applyDefault('system'))
</script>

<template>
  <div class="relative isolate flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-16">
    <div class="dark absolute inset-0 -z-10 bg-default" aria-hidden="true">
      <MzImage fill decorative alt="" :src="background.src" :srcset="background.srcset" :lqip="background.lqip" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw" />
      <div class="absolute inset-0 bg-default/55" />
    </div>
    <div class="dark">
      <MzLogo size="lg" to="/" />
    </div>
    <main class="w-full max-w-sm">
      <div class="rounded-sm bg-elevated p-8 shadow-overlay ring ring-default">
        <slot />
      </div>
    </main>
    <ULink to="/" class="dark link-underline text-small font-medium text-highlighted">{{ t('auth.backToSite') }}</ULink>
  </div>
</template>
