<script setup lang="ts">
import { socialLinks } from '~/utils/social'

/**
 * The camp's social profiles as a row of brand logos: official marks in one colour (like the
 * footers of large brands), round 44 px targets, each named for screen readers ("Mouzoun on
 * Instagram, @mouzoun_mssici") and opened in a new tab. `rel="me"` ties the profiles to the site.
 */
withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'md' })
const { t } = useI18n()
const { site } = useAppConfig()
const links = computed(() => socialLinks(site.social))
</script>

<template>
  <ul v-if="links.length" class="flex flex-wrap items-center gap-2" data-testid="social-links">
    <li v-for="l in links" :key="l.key">
      <a
        :href="l.url"
        target="_blank"
        rel="me noopener noreferrer"
        :title="l.handle ? `${l.name} · ${l.handle}` : l.name"
        :data-testid="`social-${l.key}`"
        class="flex items-center justify-center rounded-full ring ring-inset ring-default text-default transition-colors duration-300 hover:bg-inverted hover:text-inverted hover:ring-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="size === 'sm' ? 'size-9' : 'size-11'"
      >
        <UIcon :name="l.icon" :class="size === 'sm' ? 'size-4' : 'size-5'" aria-hidden="true" />
        <span class="sr-only">{{ t('footer.socialLabel', { network: l.name }) }}<template v-if="l.handle">, <span dir="ltr">{{ l.handle }}</span></template> {{ t('a11y.externalLink') }}</span>
      </a>
    </li>
  </ul>
</template>
