<script setup lang="ts">
import type { NuxtError } from '#app'
import * as uiLocales from '@nuxt/ui/locale'

const props = defineProps<{ error: NuxtError }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? uiLocales.fr)
const title = computed(() => (props.error.statusCode === 404 ? t('error.notFound') : props.error.statusCode === 503 ? t('error.unavailable') : t('error.generic')))
useHead({ title })
</script>

<template>
  <UApp :locale="uiLocale">
    <main class="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <MzLogo size="lg" />
      <p class="font-display text-7xl font-semibold text-primary tabular-nums">{{ props.error.statusCode }}</p>
      <h1 class="font-display text-2xl font-semibold">{{ title }}</h1>
      <UButton :label="t('common.backHome')" icon="i-lucide-arrow-left" :ui="{ leadingIcon: 'rtl:rotate-180' }" @click="clearError({ redirect: localePath('/') })" />
    </main>
  </UApp>
</template>
