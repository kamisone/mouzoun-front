<script setup lang="ts">
/** Account overview: the next trip first, then the sections. */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const localePath = useLocalePath()
const { account, displayName } = useAccount()
const { dateRange, date } = useDate()

const cards = computed(() => [
  { key: 'trips', icon: 'i-lucide-tent' },
  { key: 'wishlists', icon: 'i-lucide-heart' },
  { key: 'profile', icon: 'i-lucide-user-round' },
  { key: 'travellers', icon: 'i-lucide-users-round' },
  { key: 'payments', icon: 'i-lucide-credit-card' },
  { key: 'security', icon: 'i-lucide-shield-check' },
  { key: 'notifications', icon: 'i-lucide-bell' },
  { key: 'privacy', icon: 'i-lucide-lock-keyhole' },
].map(c => ({ ...c, to: localePath(`/account/${c.key}`), title: t(`account.nav.${c.key}`), text: t(`account.overview.${c.key}`) })))
</script>

<template>
  <MzAccountShell :title="t('account.overview.hello', { name: displayName })">
    <section v-if="account?.next_trip" class="flex flex-col gap-4 rounded-sm bg-elevated p-6 ring ring-default" :aria-labelledby="'next-trip'">
      <h2 id="next-trip" class="text-small font-semibold tracking-eyebrow text-muted uppercase">{{ t('account.overview.nextTrip') }}</h2>
      <p class="font-display text-h2 text-highlighted">
        {{ account.next_trip.days === 0 ? t('account.trips.today') : t('account.trips.inDays', { n: account.next_trip.days }, account.next_trip.days) }}
      </p>
      <p class="text-muted">
        {{ account.next_trip.departure ? dateRange(account.next_trip.arrival, account.next_trip.departure) : date(account.next_trip.arrival) }}
        · {{ account.next_trip.reference }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton :to="localePath(`/booking/${account.next_trip.reference}`)" :label="t('account.trips.manage')" />
        <UButton :to="localePath(`/account/trips/${account.next_trip.reference}/ticket`)" :label="t('account.trips.ticket')" icon="i-lucide-qr-code" color="neutral" variant="outline" />
      </div>
    </section>
    <MzEmptyState
      v-else
      icon="i-lucide-tent"
      :title="t('account.overview.noTrip')"
      :description="t('account.overview.noTripText')"
    >
      <UButton :to="localePath('/stays')" :label="t('common.book')" />
      <UButton :to="localePath('/account/trips/claim')" :label="t('account.claim.cta')" color="neutral" variant="outline" />
    </MzEmptyState>

    <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="c in cards" :key="c.key">
        <NuxtLink :to="c.to" class="group flex h-full flex-col gap-2 rounded-sm p-6 ring ring-default transition-colors hover:bg-elevated">
          <UIcon :name="c.icon" class="size-5 text-primary" aria-hidden="true" />
          <span class="font-medium text-highlighted">{{ c.title }}</span>
          <span class="text-small text-muted">{{ c.text }}</span>
        </NuxtLink>
      </li>
    </ul>
  </MzAccountShell>
</template>
