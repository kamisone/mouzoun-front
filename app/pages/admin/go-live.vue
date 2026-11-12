<script setup lang="ts">
import type { GoLiveCheck, GoLiveDetail } from '~/utils/admin-types'

/**
 * Opening online booking: the checklist (prices, availability, texts in every language, online
 * payment, emails) and the switch. The API refuses to open while a required check fails; this
 * page shows why and what to fix. Closing always works.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.goLive.title' })
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()
const { dateTime } = useDate()

const { data: list, pending, error, refresh } = await useAsyncData('admin-go-live', () => admin.goLive.checklist())
const confirmOpen = ref(false)
const switching = ref(false)

const required = computed(() => list.value?.checks.filter(c => c.required) ?? [])
const advice = computed(() => list.value?.checks.filter(c => !c.required) ?? [])
const failing = computed(() => required.value.filter(c => !c.ok).length)

const kind = (k?: string) => (k ? t(`admin.goLive.kinds.${k}`, k) : '')
function describe(check: GoLiveCheck, d: GoLiveDetail): string {
  switch (check.key) {
    case 'prices':
    case 'availability':
      return `${d.product} (${kind(d.kind)})`
    case 'rate_plans':
      return d.rate_plan ? t('admin.goLive.details.noPolicy', { plan: d.rate_plan }) : t('admin.goLive.details.noPlan')
    case 'content':
      return t('admin.goLive.details.untranslated', { what: t(`admin.goLive.what.${d.what}`), name: d.name, locale: d.locale?.toUpperCase() })
    case 'payments':
    case 'emails':
      return t(`admin.goLive.details.${d.missing}`)
    case 'payments_verified':
      return t(`admin.goLive.details.${d.advice}`, { n: d.count ?? 0 })
  }
}

const payment = computed(() => {
  const p = list.value?.payments
  if (!p) return null
  if (!p.online) return { tone: 'warning' as const, icon: 'i-lucide-credit-card', title: t('admin.goLive.payment.none'), text: t('admin.goLive.payment.noneText') }
  if (p.mode === 'simulated') return { tone: 'info' as const, icon: 'i-lucide-flask-conical', title: t('admin.goLive.payment.simulated'), text: t('admin.goLive.payment.simulatedText') }
  return {
    tone: p.mode === 'live' ? 'success' as const : 'info' as const,
    icon: 'i-lucide-badge-check',
    title: t(`admin.goLive.payment.${p.mode}`),
    text: p.last_webhook_at ? t('admin.goLive.payment.lastWebhook', { date: dateTime(p.last_webhook_at) }) : t('admin.goLive.payment.noWebhookYet'),
  }
})

async function setEnabled(enabled: boolean) {
  switching.value = true
  try {
    list.value = await admin.goLive.setEnabled(enabled)
    confirmOpen.value = false
    toast.add({ title: enabled ? t('admin.goLive.opened') : t('admin.goLive.closed'), color: enabled ? 'success' : 'neutral', icon: 'i-lucide-check' })
  }
  catch (e) {
    const code = apiErrorCode(e)
    toast.add({ title: code === 'go_live_blocked' ? t('admin.goLive.blocked') : (e as { statusCode?: number }).statusCode === 403 ? t('admin.crm.forbidden') : t('auth.error'), color: 'error' })
    confirmOpen.value = false
    await refresh()
  }
  finally {
    switching.value = false
  }
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <MzPageHeader :title="t('admin.goLive.title')" :description="t('admin.goLive.description')">
      <template #actions>
        <UButton :label="t('admin.goLive.recheck')" icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="pending" @click="refresh()" />
      </template>
    </MzPageHeader>

    <UAlert v-if="error" :title="t('auth.error')" color="error" variant="subtle" role="alert" />
    <MzSkeleton v-else-if="!list" variant="card" />
    <template v-else>
      <UCard variant="outline" data-testid="go-live-status">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-col gap-1">
            <p class="text-sm text-muted">{{ t('admin.goLive.state') }}</p>
            <p class="flex items-center gap-2 text-lg font-medium text-highlighted">
              <span class="size-2.5 rounded-full" :class="list.enabled ? 'bg-success' : 'bg-inverted/30'" aria-hidden="true" />
              {{ list.enabled ? t('admin.goLive.isOpen') : t('admin.goLive.isClosed') }}
            </p>
            <p class="text-sm text-muted">
              {{ list.ready ? t('admin.goLive.allGood') : t('admin.goLive.toFix', { n: failing }, failing) }}
            </p>
          </div>
          <UButton
            v-if="list.enabled"
            :label="t('admin.goLive.close')"
            color="neutral"
            variant="outline"
            :loading="switching"
            data-testid="go-live-close"
            @click="setEnabled(false)"
          />
          <UButton
            v-else
            :label="t('admin.goLive.open')"
            :disabled="!list.ready"
            :loading="switching"
            data-testid="go-live-open"
            @click="confirmOpen = true"
          />
        </div>
      </UCard>

      <UAlert
        v-if="payment"
        :title="payment.title"
        :description="payment.text"
        :color="payment.tone"
        :icon="payment.icon"
        variant="subtle"
        data-testid="payment-status"
      />

      <section aria-labelledby="required-title" class="flex flex-col gap-3">
        <h2 id="required-title" class="font-medium text-highlighted">{{ t('admin.goLive.required') }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="c in required" :key="c.key" class="rounded-sm border border-default p-4" :data-testid="`check-${c.key}`">
            <div class="flex items-start gap-3">
              <UIcon
                :name="c.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                class="mt-1 size-5 shrink-0"
                :class="c.ok ? 'text-success' : 'text-error'"
                aria-hidden="true"
              />
              <div class="flex min-w-0 flex-col gap-1">
                <p class="font-medium text-highlighted">
                  <span class="sr-only">{{ c.ok ? t('admin.goLive.ok') : t('admin.goLive.notOk') }}: </span>{{ t(`admin.goLive.checks.${c.key}`) }}
                </p>
                <p class="text-sm text-muted">{{ t(`admin.goLive.help.${c.key}`) }}</p>
                <ul v-if="!c.ok" class="mt-1 list-disc ps-4 text-sm text-highlighted">
                  <li v-for="(d, i) in c.details.slice(0, 12)" :key="i">{{ describe(c, d) }}</li>
                  <li v-if="c.details.length > 12" class="list-none text-muted">{{ t('admin.goLive.more', { n: c.details.length - 12 }) }}</li>
                </ul>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="advice.some(c => !c.ok)" aria-labelledby="advice-title" class="flex flex-col gap-3">
        <h2 id="advice-title" class="font-medium text-highlighted">{{ t('admin.goLive.recommended') }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="c in advice.filter(x => !x.ok)" :key="c.key" class="rounded-sm border border-default p-4">
            <p class="font-medium text-highlighted">{{ t(`admin.goLive.checks.${c.key}`) }}</p>
            <ul class="mt-1 list-disc ps-4 text-sm text-muted">
              <li v-for="(d, i) in c.details" :key="i">{{ describe(c, d) }}</li>
            </ul>
          </li>
        </ul>
      </section>
      <p class="text-xs text-muted">{{ t('admin.goLive.checkedAt', { date: dateTime(list.checked_at) }) }}</p>
    </template>

    <MzConfirmDialog
      v-model:open="confirmOpen"
      :title="t('admin.goLive.confirmTitle')"
      :description="t('admin.goLive.confirmText')"
      :confirm-label="t('admin.goLive.open')"
      :loading="switching"
      @confirm="setEnabled(true)"
    />
  </div>
</template>
