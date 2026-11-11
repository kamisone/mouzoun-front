<script setup lang="ts">
/**
 * Footer: always dark (night), generous, small link columns, newsletter, language switch, legal
 * links and the credits of the placeholder photos (CC licences require them).
 */
const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const appConfig = useAppConfig()
const site = computed(() => appConfig.site)
const { all } = usePhoto()
const year = new Date().getFullYear()
const email = ref('')
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
        <p>© {{ year }} Mouzoun · {{ site.address }}</p>
        <div class="flex flex-wrap items-center gap-6">
          <span>{{ t('footer.legal') }}</span>
          <span>{{ t('footer.privacy') }}</span>
          <details class="group">
            <summary class="cursor-pointer list-none hover:text-default">{{ t('footer.photoCredits') }}</summary>
            <ul class="mt-4 flex flex-col gap-1">
              <li v-for="p in all()" :key="p.slug">
                <a :href="p.credit.sourcePage" target="_blank" rel="noopener" class="hover:text-default">{{ p.credit.author }}</a>,
                {{ p.credit.place }} — <a :href="p.credit.licenseUrl" target="_blank" rel="noopener" class="hover:text-default">{{ p.credit.license }}</a>
              </li>
            </ul>
          </details>
          <MzLocaleSwitcher variant="text" size="sm" />
        </div>
      </MzContainer>
    </div>
  </footer>
</template>
