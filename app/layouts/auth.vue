<script setup lang="ts">
/** Sign-in pages: one centred card over a desert backdrop (image from settings, else gradient). */
const { site } = useAppConfig()
const { t } = useI18n()
const { applyDefault } = useThemePreference()
onMounted(() => applyDefault('system'))
</script>

<template>
  <div class="relative isolate flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-12">
    <div class="absolute inset-0 -z-10" aria-hidden="true">
      <NuxtImg v-if="site.authBackground" :src="site.authBackground" alt="" class="size-full object-cover" sizes="100vw" />
      <div v-else class="size-full bg-linear-to-b from-primary/25 via-warning/15 to-muted" />
      <div class="absolute inset-0 bg-default/40" />
    </div>
    <MzLogo size="lg" />
    <main class="w-full max-w-sm">
      <UCard class="shadow-lifted" :ui="{ body: 'p-6 sm:p-8' }">
        <slot />
      </UCard>
    </main>
    <ULink to="/" class="text-sm font-medium text-highlighted hover:text-primary">{{ t('auth.backToSite') }}</ULink>
  </div>
</template>
