<script setup lang="ts">
import { socialLinks } from '~/utils/social'

/**
 * Footer: always dark (night), generous, small link columns, social profiles, newsletter, language switch, legal
 * links.
 */
const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const appConfig = useAppConfig()
const site = computed(() => appConfig.site)
const year = new Date().getFullYear()
const { reopen } = useConsent()
// Seller identity and legal pages (French law: mentions légales, CGV...), from the shop config.
const { data: shop } = useShopConfig()
const legalLinks = computed(() => {
  const pages = shop.value?.legal_pages ?? {}
  return (['notice', 'cgv', 'privacy', 'cookies', 'withdrawal', 'shipping'] as const)
    .filter(k => pages[k])
    .map(k => ({ key: k, label: t(`footer.legalPages.${k}`), to: localePath(`/${pages[k]}`) }))
})
const email = ref('')

// The official profiles, also declared to search engines (schema.org sameAs) so they show
// with the site in results and knowledge panels.
const social = computed(() => socialLinks(site.value.social))
const siteUrl = useRuntimeConfig().public.i18n?.baseUrl as string | undefined
useHead(() => ({
  script: social.value.length
    ? [{
        key: 'ld-organization',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          'name': 'Mouzoun',
          ...(siteUrl ? { url: siteUrl, logo: `${siteUrl}/favicon.svg` } : {}),
          ...(site.value.email ? { email: site.value.email } : {}),
          'sameAs': social.value.map(l => l.url),
        }),
      }]
    : [],
}))
const mapsUrl = computed(() => `https://www.google.com/maps?q=${site.value.location.lat},${site.value.location.lng}`)

const columns = computed(() => [
  {
    title: t('footer.discover'),
    links: [
      { label: t('nav.stay'), to: `${localePath('/')}#stay` },
      { label: t('nav.activities'), to: `${localePath('/')}#experiences` },
      { label: t('nav.farm'), to: `${localePath('/')}#farm` },
    ],
  },
  {
    title: t('footer.visit'),
    links: [
      { label: t('nav.practical'), to: `${localePath('/')}#practical` },
      { label: t('common.openInMaps'), to: mapsUrl.value, external: true },
      ...(site.value.email ? [{ label: site.value.email, to: `mailto:${site.value.email}` }] : []),
    ],
  },
])

// The newsletter API does not exist yet: the form is the final design, without a backend.
function subscribe() {
  toast.add({ title: t('footer.newsletterSoon'), icon: 'i-lucide-mail' })
  email.value = ''
}
</script>

<template>
  <footer id="contact" class="dark bg-default text-default">
    <MzContainer class="grid gap-12 py-24 lg:grid-cols-12 lg:gap-8 lg:py-32">
      <div class="lg:col-span-4">
        <MzLogo size="lg" />
        <p class="mt-6 max-w-xs text-small text-muted">{{ t('footer.tagline') }}</p>
        <div v-if="social.length" class="mt-8">
          <h2 class="eyebrow mb-4">{{ t('footer.followUs') }}</h2>
          <MzSocialLinks />
        </div>
      </div>
      <nav v-for="column in columns" :key="column.title" class="lg:col-span-2" :aria-label="column.title">
        <h2 class="eyebrow mb-6">{{ column.title }}</h2>
        <ul class="flex flex-col gap-3">
          <li v-for="link in column.links" :key="link.label">
            <ULink :to="link.to" :target="link.external ? '_blank' : undefined" :rel="link.external ? 'noopener' : undefined" class="text-small text-default transition-opacity hover:opacity-70">
              {{ link.label }}<span v-if="link.external" class="sr-only"> {{ t('a11y.externalLink') }}</span>
            </ULink>
          </li>
        </ul>
      </nav>
      <div class="lg:col-span-4">
        <h2 class="eyebrow mb-6">{{ t('footer.newsletter') }}</h2>
        <p class="mb-4 text-small text-muted">{{ t('footer.newsletterText') }}</p>
        <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="subscribe">
          <UInput v-model="email" type="email" required autocomplete="email" :placeholder="t('footer.emailPlaceholder')" :aria-label="t('footer.emailPlaceholder')" class="flex-1" />
          <UButton type="submit" :label="t('footer.subscribe')" color="neutral" variant="outline" />
        </form>
      </div>
    </MzContainer>
    <div class="border-t border-default">
      <MzContainer class="flex flex-col gap-4 py-8 text-caption text-muted md:flex-row md:items-center md:justify-between">
        <p>
          © {{ year }} Mouzoun · {{ site.address }}
          <template v-if="shop?.seller">
            <br><span data-testid="footer-seller">{{ t('footer.seller', { name: shop.seller.legal_name, form: shop.seller.legal_form }) }}<template v-if="shop.seller.siren"> · SIREN {{ shop.seller.siren }}</template></span>
          </template>
        </p>
        <div class="flex flex-wrap items-center gap-6">
          <nav v-if="legalLinks.length" :aria-label="t('footer.legal')" class="flex flex-wrap gap-x-6 gap-y-2">
            <NuxtLink v-for="l in legalLinks" :key="l.key" :to="l.to" class="hover:text-default">{{ l.label }}</NuxtLink>
          </nav>
          <template v-else>
            <span>{{ t('footer.legal') }}</span>
            <span>{{ t('footer.privacy') }}</span>
          </template>
          <button type="button" class="hover:text-default" data-testid="footer-cookies" @click="reopen">{{ t('footer.cookies') }}</button>
          <MzLocaleSwitcher variant="text" size="sm" />
        </div>
      </MzContainer>
    </div>
  </footer>
</template>
