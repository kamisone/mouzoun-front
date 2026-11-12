<script setup lang="ts">
import type { Ticket } from '~/utils/account-types'

/**
 * The ticket of a trip: a QR code the camp scans on arrival. Kept on this device so it opens
 * without a connection (the desert road has little signal).
 */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const api = useAccountApi()
const { dateRange, date, dateTime } = useDate()
const online = useOnline()

const reference = computed(() => String(route.params.reference).toUpperCase())
const key = computed(() => `mz-ticket:${reference.value}`)
const ticket = ref<Ticket | null>(null)
const offlineCopy = ref(false)
const error = ref<string | null>(null)
const loading = ref(true)

function cached(): Ticket | null {
  try {
    const value = JSON.parse(localStorage.getItem(key.value) ?? 'null') as Ticket | null
    return value && new Date(value.expires_at) > new Date() ? value : null
  }
  catch {
    return null
  }
}

onMounted(async () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  try {
    ticket.value = await api.ticket(reference.value)
    try {
      localStorage.setItem(key.value, JSON.stringify(ticket.value))
    }
    catch { /* not kept offline */ }
  }
  catch (e) {
    ticket.value = cached()
    offlineCopy.value = !!ticket.value
    if (!ticket.value) error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    loading.value = false
  }
})

const party = computed(() => {
  const g = ticket.value?.guests
  if (!g) return ''
  return [
    g.adults ? t('account.party.adults', { n: g.adults }, g.adults) : null,
    g.children ? t('account.party.children', { n: g.children }, g.children) : null,
    g.infants ? t('account.party.infants', { n: g.infants }, g.infants) : null,
  ].filter(Boolean).join(' · ')
})
</script>

<template>
  <MzAccountShell :title="t('account.ticket.title')">
    <div v-if="loading" class="flex flex-col gap-4" aria-busy="true"><MzSkeleton class="aspect-square max-w-72" /></div>
    <UAlert v-else-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
    <article v-else-if="ticket" class="flex max-w-md flex-col items-center gap-6 rounded-sm bg-elevated p-8 text-center ring ring-default" data-testid="ticket">
      <UAlert
        v-if="offlineCopy || !online"
        :title="t('account.ticket.offline')"
        color="info"
        variant="subtle"
        icon="i-lucide-wifi-off"
        class="text-start"
      />
      <p class="font-display text-h2 text-highlighted">{{ ticket.lead }}</p>
      <MzQrCode :value="ticket.token" :label="t('account.ticket.qrLabel', { reference: ticket.reference })" />
      <dl class="grid w-full grid-cols-2 gap-4 text-start text-small">
        <div>
          <dt class="text-muted">{{ t('account.ticket.reference') }}</dt>
          <dd class="font-mono font-medium text-highlighted">{{ ticket.reference }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('account.ticket.dates') }}</dt>
          <dd class="font-medium text-highlighted">
            {{ ticket.arrival_date && ticket.departure_date ? dateRange(ticket.arrival_date, ticket.departure_date) : ticket.arrival_date ? date(ticket.arrival_date) : '—' }}
          </dd>
        </div>
        <div class="col-span-2">
          <dt class="text-muted">{{ t('account.ticket.party') }}</dt>
          <dd class="font-medium text-highlighted">{{ party }}</dd>
        </div>
        <div v-if="ticket.items.length" class="col-span-2">
          <dt class="text-muted">{{ t('account.ticket.items') }}</dt>
          <dd>
            <ul class="flex flex-col gap-1">
              <li v-for="(item, i) in ticket.items" :key="i" class="text-highlighted">
                {{ item.name }}<span v-if="item.starts_at" class="text-muted"> · {{ dateTime(item.starts_at) }}</span>
              </li>
            </ul>
          </dd>
        </div>
      </dl>
      <p class="text-caption text-muted">{{ t('account.ticket.hint') }}</p>
      <UButton :to="localePath(`/booking/${ticket.reference}`)" :label="t('account.trips.manage')" color="neutral" variant="outline" />
    </article>
  </MzAccountShell>
</template>
