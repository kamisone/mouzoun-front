<script setup lang="ts">
/** Public footer: contact (also the #contact anchor), map link, socials, legal links. */
const { t } = useI18n()
const appConfig = useAppConfig()
const site = computed(() => appConfig.site)
const year = new Date().getFullYear()
const socials = computed(() =>
  (Object.entries(site.value.social) as [string, string][])
    .filter(([, url]) => url)
    .map(([name, url]) => ({ name, url, icon: `i-simple-icons-${name}` })),
)
const mapsUrl = computed(() => `https://www.google.com/maps?q=${site.value.location.lat},${site.value.location.lng}`)
const whatsappUrl = computed(() => `https://wa.me/${site.value.whatsapp.replace(/\D/g, '')}`)
</script>

<template>
  <footer id="contact" class="border-t border-default bg-muted">
    <MzContainer class="grid gap-10 py-12 md:grid-cols-3">
      <div class="flex flex-col gap-3">
        <MzLogo />
        <p class="max-w-xs text-sm text-muted">{{ t('footer.tagline') }}</p>
      </div>
      <div>
        <h2 class="mb-3 font-sans text-sm font-semibold tracking-wide text-highlighted uppercase">{{ t('footer.contact') }}</h2>
        <ul class="flex flex-col gap-2 text-sm">
          <li v-if="site.address" class="flex items-start gap-2 text-muted">
            <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <ULink :to="mapsUrl" target="_blank" rel="noopener" class="hover:text-primary">
              {{ site.address }}<span class="sr-only"> {{ t('a11y.externalLink') }}</span>
            </ULink>
          </li>
          <li v-if="site.phone" class="flex items-center gap-2 text-muted">
            <UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />
            <ULink :to="`tel:${site.phone}`" class="hover:text-primary"><span dir="ltr">{{ site.phone }}</span></ULink>
          </li>
          <li v-if="site.whatsapp" class="flex items-center gap-2 text-muted">
            <UIcon name="i-lucide-message-circle" class="size-4" aria-hidden="true" />
            <ULink :to="whatsappUrl" target="_blank" rel="noopener" class="hover:text-primary"><span dir="ltr">{{ site.whatsapp }}</span></ULink>
          </li>
          <li v-if="site.email" class="flex items-center gap-2 text-muted">
            <UIcon name="i-lucide-mail" class="size-4" aria-hidden="true" />
            <ULink :to="`mailto:${site.email}`" class="hover:text-primary">{{ site.email }}</ULink>
          </li>
        </ul>
      </div>
      <div v-if="socials.length">
        <h2 class="mb-3 font-sans text-sm font-semibold tracking-wide text-highlighted uppercase">{{ t('footer.followUs') }}</h2>
        <div class="flex gap-1">
          <UButton
            v-for="s in socials"
            :key="s.name"
            :to="s.url"
            target="_blank"
            rel="noopener"
            :icon="s.icon"
            color="neutral"
            variant="ghost"
            :aria-label="`${s.name} ${t('a11y.externalLink')}`"
          />
        </div>
      </div>
    </MzContainer>
    <div class="border-t border-default">
      <MzContainer class="flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
        <p>© {{ year }} Mouzoun. {{ t('footer.rights') }}</p>
        <!-- Legal pages come with the content pages; the links are listed in the missing texts. -->
        <p class="flex gap-4">
          <span>{{ t('footer.legal') }}</span>
          <span>{{ t('footer.privacy') }}</span>
        </p>
      </MzContainer>
    </div>
  </footer>
</template>
