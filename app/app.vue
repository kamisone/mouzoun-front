<script setup lang="ts">
// Adds <html lang>, hreflang alternates and canonical links for SEO
const head = useLocaleHead()
useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs.lang },
  link: [...(head.value.link ?? [])],
  meta: [...(head.value.meta ?? [])],
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
