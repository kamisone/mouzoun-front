<script setup lang="ts">
/**
 * Frame of every account page: title, the account sections (side list on large screens, a
 * scrollable row of links on small ones) and the page content.
 */
const props = defineProps<{ title: string, description?: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { account, signOut } = useAccount()

const sections = computed(() => [
  { key: 'overview', icon: 'i-lucide-house', to: localePath('/account') },
  { key: 'trips', icon: 'i-lucide-tent', to: localePath('/account/trips') },
  { key: 'wishlists', icon: 'i-lucide-heart', to: localePath('/account/wishlists') },
  { key: 'profile', icon: 'i-lucide-user-round', to: localePath('/account/profile') },
  { key: 'travellers', icon: 'i-lucide-users-round', to: localePath('/account/travellers') },
  { key: 'payments', icon: 'i-lucide-credit-card', to: localePath('/account/payments') },
  { key: 'security', icon: 'i-lucide-shield-check', to: localePath('/account/security') },
  { key: 'notifications', icon: 'i-lucide-bell', to: localePath('/account/notifications') },
  { key: 'privacy', icon: 'i-lucide-lock-keyhole', to: localePath('/account/privacy') },
].map(s => ({ ...s, label: t(`account.nav.${s.key}`), active: s.key === 'overview' ? route.path === s.to : route.path.startsWith(s.to) })))

useHead({ title: () => `${props.title} · ${t('common.siteName')}`, meta: [{ name: 'robots', content: 'noindex' }] })

async function leave() {
  await signOut()
  await navigateTo(localePath('/'))
}
</script>

<template>
  <MzContainer class="py-12 lg:py-16">
    <div class="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav :aria-label="t('account.nav.label')" class="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <p v-if="account" class="mb-4 hidden truncate text-small text-muted lg:block">{{ account.email }}</p>
        <ul class="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          <li v-for="s in sections" :key="s.key" class="shrink-0">
            <NuxtLink
              :to="s.to"
              :aria-current="s.active ? 'page' : undefined"
              class="flex items-center gap-3 rounded-sm px-3 py-2 text-small font-medium transition-colors"
              :class="s.active ? 'bg-elevated text-highlighted' : 'text-muted hover:bg-elevated/60 hover:text-highlighted'"
            >
              <UIcon :name="s.icon" class="size-4" aria-hidden="true" />
              {{ s.label }}
            </NuxtLink>
          </li>
          <li class="shrink-0 lg:mt-4">
            <UButton :label="t('account.signOut')" icon="i-lucide-log-out" color="neutral" variant="ghost" size="sm" @click="leave" />
          </li>
        </ul>
      </nav>
      <div class="flex min-w-0 flex-col gap-8">
        <header class="flex flex-col gap-2">
          <h1 class="font-display text-h1 text-highlighted">{{ props.title }}</h1>
          <p v-if="props.description" class="max-w-prose text-muted">{{ props.description }}</p>
        </header>
        <slot />
      </div>
    </div>
    <MzReauthDialog />
  </MzContainer>
</template>
