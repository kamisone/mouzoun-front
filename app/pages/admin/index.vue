<script setup lang="ts">
import type { TodayDashboard } from '~/utils/admin-types'

/**
 * Today, for the reception: arrivals, departures, guests in house, today's activity departures
 * with their fill rate, requests waiting for an answer (with the deadline), balances due,
 * failed payments, missing pre-check-ins and alerts.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.dashboard' })

const { t } = useI18n()
const { user } = useAuth()
const admin = useAdminApi()
const { money } = useMoney()
const { date, dateTime } = useDate()
const { data, refresh, pending } = await useAsyncData<TodayDashboard | null>('admin-today', () => admin.dashboard().catch(() => null))
useIntervalFn(() => refresh(), 60_000)
// Whether guests can book and pay online right now (go-live page for the details).
const { data: goLive } = await useAsyncData('admin-today-go-live', () => admin.goLive.checklist().catch(() => null))

const name = (r: { first_name: string | null, last_name: string | null }) => [r.first_name, r.last_name].filter(Boolean).join(' ')
const { time } = useDate()
const lists = computed(() => [
  { key: 'arrivals', title: t('admin.today.arrivals'), icon: 'i-lucide-log-in', rows: data.value?.arrivals ?? [] },
  { key: 'departures', title: t('admin.today.departures'), icon: 'i-lucide-log-out', rows: data.value?.departures ?? [] },
  { key: 'in_house', title: t('admin.today.inHouse'), icon: 'i-lucide-tent', rows: data.value?.in_house ?? [] },
])
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="t('admin.today.title')" :description="data ? date(data.date, 'weekday') : (user ? t('admin.welcome', { name: user.full_name }) : undefined)">
      <template #actions>
        <UButton to="/admin/bookings/new" icon="i-lucide-plus" :label="t('admin.bookings.new')" />
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="pending" :aria-label="t('admin.refresh')" @click="refresh()" />
      </template>
    </MzPageHeader>

    <div v-if="goLive && (!goLive.enabled || !goLive.payments.online)" class="flex flex-wrap gap-3" data-testid="booking-state">
      <UAlert
        v-if="!goLive.enabled"
        color="info"
        variant="subtle"
        icon="i-lucide-door-closed"
        :title="t('admin.goLive.bannerClosed')"
        :actions="[{ label: t('admin.goLive.title'), to: '/admin/go-live', color: 'neutral', variant: 'outline' }]"
        class="w-auto"
      />
      <UAlert
        v-if="!goLive.payments.online"
        color="warning"
        variant="subtle"
        icon="i-lucide-credit-card"
        :title="t('admin.goLive.payment.none')"
        :description="t('admin.goLive.payment.noneText')"
        class="w-auto"
      />
    </div>

    <div v-if="data && (data.alerts.open_tasks || data.alerts.webhook_errors || data.alerts.dead_events)" class="flex flex-wrap gap-3">
      <UAlert v-if="data.alerts.open_tasks" color="warning" variant="subtle" icon="i-lucide-list-todo" :title="t('admin.today.openTasks', { n: data.alerts.open_tasks }, data.alerts.open_tasks)" class="w-auto" />
      <UAlert v-if="data.alerts.webhook_errors" color="error" variant="subtle" icon="i-lucide-webhook" :title="t('admin.today.webhookErrors', { n: data.alerts.webhook_errors })" class="w-auto" />
      <UAlert v-if="data.alerts.dead_events" color="error" variant="subtle" icon="i-lucide-mail-x" :title="t('admin.today.deadEvents', { n: data.alerts.dead_events })" class="w-auto" />
    </div>

    <MzGrid :cols="4" gap="sm">
      <MzStatCard :label="t('admin.today.arrivals')" :value="data?.arrivals.length ?? null" icon="i-lucide-log-in" />
      <MzStatCard :label="t('admin.today.departures')" :value="data?.departures.length ?? null" icon="i-lucide-log-out" />
      <MzStatCard :label="t('admin.today.inHouse')" :value="data?.in_house.length ?? null" icon="i-lucide-tent" />
      <MzStatCard :label="t('admin.today.requests')" :value="data?.requests.length ?? null" icon="i-lucide-hourglass" />
    </MzGrid>

    <div class="grid gap-6 xl:grid-cols-3">
      <UCard v-for="list in lists" :key="list.key">
        <template #header>
          <h2 class="flex items-center gap-2 font-medium text-highlighted"><UIcon :name="list.icon" class="size-4 text-muted" />{{ list.title }}</h2>
        </template>
        <ul v-if="list.rows.length" class="flex flex-col divide-y divide-default">
          <li v-for="r in list.rows" :key="r.id" class="flex items-center justify-between gap-3 py-2">
            <NuxtLink :to="`/admin/bookings/${r.id}`" class="min-w-0">
              <p class="truncate font-medium text-highlighted">{{ name(r) }}</p>
              <p class="truncate text-small text-muted">{{ r.reference }} · {{ r.products }}</p>
            </NuxtLink>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <MzStatusBadge :status="r.status" size="sm" />
              <span v-if="r.total_minor > r.paid_minor" class="text-caption text-warning">{{ money(r.total_minor - r.paid_minor) }}</span>
            </div>
          </li>
        </ul>
        <p v-else class="text-small text-muted">{{ t('admin.today.none') }}</p>
      </UCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <UCard>
        <template #header><h2 class="font-medium text-highlighted">{{ t('admin.today.slots') }}</h2></template>
        <ul v-if="data?.slots.length" class="flex flex-col gap-3">
          <li v-for="s in data.slots" :key="s.id" class="flex flex-col gap-1">
            <p class="flex justify-between gap-3 text-small">
              <span class="font-medium text-highlighted">{{ time(s.starts_at) }} · {{ s.name }}</span>
              <span class="tabular-nums text-muted">{{ s.reserved }} / {{ s.capacity }}</span>
            </p>
            <UProgress :model-value="Math.round(s.fill_rate * 100)" size="sm" :aria-label="t('admin.today.fill', { name: s.name })" />
            <p v-if="s.guide || s.language" class="text-caption text-muted">{{ [s.guide, s.language].filter(Boolean).join(' · ') }}</p>
          </li>
        </ul>
        <p v-else class="text-small text-muted">{{ t('admin.today.none') }}</p>
      </UCard>

      <UCard>
        <template #header><h2 class="font-medium text-highlighted">{{ t('admin.today.requests') }}</h2></template>
        <ul v-if="data?.requests.length" class="flex flex-col divide-y divide-default">
          <li v-for="r in data.requests" :key="r.id" class="flex items-center justify-between gap-3 py-2">
            <NuxtLink :to="`/admin/bookings/${r.id}`" class="min-w-0">
              <p class="font-medium text-highlighted">{{ name(r) }} · {{ r.reference }}</p>
              <p class="text-small text-muted">{{ r.arrival ? date(r.arrival) : '' }} · {{ money(r.total_minor) }}</p>
            </NuxtLink>
            <span v-if="r.answer_by" class="shrink-0 text-small text-warning">{{ t('admin.today.answerBy', { date: dateTime(r.answer_by) }) }}</span>
          </li>
        </ul>
        <p v-else class="text-small text-muted">{{ t('admin.today.none') }}</p>
      </UCard>

      <UCard>
        <template #header><h2 class="font-medium text-highlighted">{{ t('admin.today.balances') }}</h2></template>
        <ul v-if="data?.balances_due.length" class="flex flex-col divide-y divide-default">
          <li v-for="r in data.balances_due" :key="r.id" class="flex justify-between gap-3 py-2 text-small">
            <NuxtLink :to="`/admin/bookings/${r.id}`" class="font-medium text-highlighted">{{ name(r) }} · {{ r.reference }}</NuxtLink>
            <span class="tabular-nums">{{ money(r.due_minor) }} <span class="text-muted">{{ r.due_on ? date(r.due_on, 'medium') : '' }}</span></span>
          </li>
        </ul>
        <p v-else class="text-small text-muted">{{ t('admin.today.none') }}</p>
      </UCard>

      <UCard>
        <template #header><h2 class="font-medium text-highlighted">{{ t('admin.today.attention') }}</h2></template>
        <ul class="flex flex-col gap-2 text-small">
          <li v-for="p in data?.failed_payments ?? []" :key="p.id" class="flex justify-between gap-3">
            <NuxtLink :to="`/admin/bookings/${p.booking_id}`" class="text-error">{{ t('admin.today.failedPayment', { reference: p.reference, amount: money(p.amount_minor) }) }}</NuxtLink>
            <span class="text-muted">{{ p.reason }}</span>
          </li>
          <li v-for="p in data?.precheckin_missing ?? []" :key="p.id">
            <NuxtLink :to="`/admin/bookings/${p.id}`" class="text-warning">{{ t('admin.today.precheckinMissing', { name: name(p), date: p.arrival ? date(p.arrival, 'medium') : '' }) }}</NuxtLink>
          </li>
          <li v-if="!data?.failed_payments.length && !data?.precheckin_missing.length" class="text-muted">{{ t('admin.today.none') }}</li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
