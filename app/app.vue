<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale'

const { locale } = useI18n()
// <html lang dir> from i18n. Canonical, hreflang and robots from the route registry (the sitemap's
// rule) for public content; i18n's links for the rest (account, cart...).
const head = useLocaleHead()
const seo = useSeoHead()
useHead(() => {
  const s = seo.value
  const i18nLinks = head.value.link ?? []
  return {
    htmlAttrs: { lang: head.value.htmlAttrs.lang, dir: head.value.htmlAttrs.dir },
    link: s
      ? [
          ...i18nLinks.filter(l => l.rel !== 'canonical' && l.rel !== 'alternate'),
          ...(s.canonical ? [{ key: 'canonical', rel: 'canonical' as const, href: s.canonical }] : []),
          ...s.alternates.map(a => ({ key: `alt-${a.hreflang}`, rel: 'alternate' as const, hreflang: a.hreflang, href: a.href })),
        ]
      : [...i18nLinks],
    meta: [
      ...(head.value.meta ?? []),
      ...(s?.noindex ? [{ key: 'robots', name: 'robots' as const, content: 'noindex, follow' }] : []),
    ],
  }
})

// Nuxt UI components (calendar, pagination, dialogs...) follow the language and direction.
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? uiLocales.fr)
</script>

<template>
  <UApp :locale="uiLocale" :toaster="{ position: 'bottom-right' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
