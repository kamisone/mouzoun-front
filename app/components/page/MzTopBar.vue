<script setup lang="ts">
import { interpolate } from '~/utils/page-builder'

/**
 * Site-wide announcement (`top_bar` banners, e.g. "Opening on {opening_date}: pre-book now").
 * Server-rendered (no layout shift); dismissed for the session with a cookie. The date comes from
 * the `site.opening_date` setting.
 */
interface Banner { id: string, message: string, cta_label: string | null, link_url: string | null }
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { data } = useAsyncData(`banners:top_bar:${locale.value}`, () =>
  $fetch<{ banners: Banner[], variables: Record<string, string | null> }>('/v1/banners', { baseURL: useApiBase(), query: { placement: 'top_bar', locale: locale.value } }).catch(() => null), { watch: [locale] })
const dismissed = useCookie<string[]>('mz-dismissed-banners', { default: () => [], sameSite: 'lax' })
const banner = computed(() => data.value?.banners.find(b => !dismissed.value.includes(b.id)))
const message = computed(() => (banner.value ? interpolate(banner.value.message, data.value?.variables ?? {}, locale.value) : ''))
const to = computed(() => {
  const url = banner.value?.link_url
  if (!url) return undefined
  return url.startsWith('/') ? localePath(url.split('#')[0] || '/') + (url.includes('#') ? `#${url.split('#')[1]}` : '') : url
})
</script>

<template>
  <div v-if="banner" class="dark relative bg-default text-small text-default" data-testid="top-bar">
      <MzContainer class="flex min-h-10 items-center justify-center gap-4 py-2 text-center">
        <p>{{ message }}</p>
        <NuxtLink v-if="to && banner.cta_label" :to="to" class="link-underline font-medium text-highlighted">{{ banner.cta_label }}</NuxtLink>
        <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" class="absolute end-2" :aria-label="t('common.close')" @click="dismissed = [...dismissed, banner.id]" />
      </MzContainer>
    </div>
</template>
