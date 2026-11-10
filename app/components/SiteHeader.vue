<script setup lang="ts">
const { locale, locales } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const otherLocales = computed(() => locales.value.filter((l) => l.code !== locale.value))
</script>

<template>
  <header class="border-b border-sand-100 bg-white/80 backdrop-blur">
    <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <NuxtLink :to="localePath('/')" class="text-xl font-bold text-terracotta-600">Mouzoun</NuxtLink>
      <div class="flex items-center gap-6 text-sm font-medium">
        <NuxtLink :to="localePath('/activities')" class="hover:text-terracotta-500">
          {{ $t('nav.activities') }}
        </NuxtLink>
        <NuxtLink
          v-for="l in otherLocales"
          :key="l.code"
          :to="switchLocalePath(l.code)"
          class="rounded border border-sand-500 px-2 py-1 uppercase"
        >
          {{ l.code }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>
