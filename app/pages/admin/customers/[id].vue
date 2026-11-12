<script setup lang="ts">
/**
 * One customer: details, account, bookings, history, and the actions (sign-in link, suspend,
 * sign out everywhere, merge a duplicate, view as the customer, export, deletion). Each action
 * needs its permission and is recorded in the history.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.crm.detail' })
const { t } = useI18n()
const route = useRoute()
const admin = useAdminApi()
const toast = useToast()
const { money } = useMoney()
const { date, dateTime, dateRange } = useDate()
const id = computed(() => String(route.params.id))
const { data: c, refresh } = await useAsyncData(`crm-${id.value}`, () => admin.crm.get(id.value))

async function act(fn: () => Promise<unknown>, done: string) {
  try {
    await fn()
    toast.add({ title: done, color: 'success', icon: 'i-lucide-check' })
    await refresh()
  }
  catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    toast.add({ title: status === 403 ? t('admin.crm.forbidden') : t(`admin.crm.errors.${apiErrorCode(e)}`, t('auth.error')), color: 'error' })
  }
}

// Merge: pick the duplicate among search results.
const mergeOpen = ref(false)
const mergeQuery = ref('')
const mergeTarget = ref<string | undefined>(undefined)
const { data: candidates } = await useAsyncData('crm-merge', () => (mergeQuery.value.length > 1 ? admin.crm.list({ q: mergeQuery.value }) : Promise.resolve(null)), { watch: [mergeQuery] })
const mergeItems = computed(() => (candidates.value?.customers ?? []).filter(x => x.id !== id.value).map(x => ({ value: x.id, label: `${x.first_name} ${x.last_name ?? ''} · ${x.email ?? x.phone ?? ''}` })))
async function merge() {
  if (!mergeTarget.value) return
  await act(() => admin.crm.merge(mergeTarget.value!, id.value), t('admin.crm.merged'))
  mergeOpen.value = false
}

const viewAs = ref<Awaited<ReturnType<typeof admin.crm.viewAs>> | null>(null)
async function openViewAs() {
  try {
    viewAs.value = await admin.crm.viewAs(id.value)
  }
  catch {
    toast.add({ title: t('admin.crm.forbidden'), color: 'error' })
  }
}

async function exportData() {
  try {
    const data = await admin.crm.export(id.value)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `customer-${id.value}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  catch {
    toast.add({ title: t('admin.crm.forbidden'), color: 'error' })
  }
}
const deleteOpen = ref(false)
</script>

<template>
  <div v-if="c" class="flex flex-col gap-6">
    <MzPageHeader :title="`${c.first_name} ${c.last_name ?? ''}`" :breadcrumbs="[{ label: t('admin.customers'), to: '/admin/customers' }, { label: c.first_name }]">
      <template #actions>
        <UDropdownMenu
          :items="[
            [
              { label: t('admin.crm.actions.signInLink'), icon: 'i-lucide-mail', disabled: !c.email, onSelect: () => act(() => admin.crm.signInLink(c!.id), t('admin.crm.sent')) },
              { label: t('admin.crm.actions.viewAs'), icon: 'i-lucide-eye', disabled: !c.account, onSelect: openViewAs },
            ],
            [
              c.account?.status === 'suspended'
                ? { label: t('admin.crm.actions.reactivate'), icon: 'i-lucide-user-check', onSelect: () => act(() => admin.crm.reactivate(c!.id), t('admin.crm.done')) }
                : { label: t('admin.crm.actions.suspend'), icon: 'i-lucide-user-x', disabled: !c.account, onSelect: () => act(() => admin.crm.suspend(c!.id), t('admin.crm.done')) },
              { label: t('admin.crm.actions.signOutAll'), icon: 'i-lucide-log-out', disabled: !c.account, onSelect: () => act(() => admin.crm.signOutAll(c!.id), t('admin.crm.done')) },
              { label: t('admin.crm.actions.merge'), icon: 'i-lucide-merge', onSelect: () => { mergeOpen = true } },
            ],
            [
              { label: t('admin.crm.actions.export'), icon: 'i-lucide-download', disabled: !c.account, onSelect: exportData },
              { label: t('admin.crm.actions.delete'), icon: 'i-lucide-trash-2', color: 'error', disabled: !c.account, onSelect: () => { deleteOpen = true } },
            ],
          ]"
        >
          <UButton :label="t('admin.crm.actionsLabel')" icon="i-lucide-ellipsis" color="neutral" variant="outline" />
        </UDropdownMenu>
      </template>
    </MzPageHeader>

    <div class="grid gap-6 lg:grid-cols-3">
      <UCard variant="outline" class="lg:col-span-1">
        <dl class="flex flex-col gap-3 text-sm">
          <div><dt class="text-muted">{{ t('admin.crm.email') }}</dt><dd class="text-highlighted" dir="ltr">{{ c.email ?? '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.phone') }}</dt><dd class="text-highlighted" dir="ltr">{{ c.phone ?? '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.country') }}</dt><dd class="text-highlighted">{{ c.country_code ?? '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.marketing') }}</dt><dd class="text-highlighted">{{ c.marketing_consent ? t('admin.crm.yesSince', { date: c.marketing_consent_at ? date(c.marketing_consent_at) : '' }) : t('admin.crm.no') }}</dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.since') }}</dt><dd class="text-highlighted">{{ date(c.created_at) }}</dd></div>
        </dl>
      </UCard>
      <UCard variant="outline" class="lg:col-span-2">
        <template #header><h2 class="font-medium">{{ t('admin.crm.account') }}</h2></template>
        <p v-if="!c.account" class="text-sm text-muted">{{ t('admin.crm.noAccount') }}</p>
        <dl v-else class="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt class="text-muted">{{ t('admin.crm.statusLabel') }}</dt><dd><UBadge :label="t(`admin.crm.status.${c.account.status}`)" :color="c.account.status === 'suspended' ? 'error' : 'success'" variant="subtle" /></dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.lastLogin') }}</dt><dd class="text-highlighted">{{ c.account.last_login_at ? dateTime(c.account.last_login_at) : '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.methodsLabel') }}</dt><dd class="text-highlighted">{{ [t('admin.crm.methods.code'), c.account.has_password ? t('admin.crm.methods.password') : null, ...c.account.identities.map(i => t(`admin.crm.methods.${i.provider}`))].filter(Boolean).join(', ') }}</dd></div>
          <div><dt class="text-muted">{{ t('admin.crm.sessions') }}</dt><dd class="text-highlighted">{{ c.account.active_sessions }}</dd></div>
          <div v-if="c.account.deletion_scheduled_for" class="sm:col-span-2">
            <UAlert :title="t('admin.crm.deletionScheduled', { date: date(c.account.deletion_scheduled_for) })" color="warning" variant="subtle" />
          </div>
        </dl>
      </UCard>
    </div>

    <UCard variant="outline">
      <template #header><h2 class="font-medium">{{ t('admin.crm.bookings') }} ({{ c.bookings.length }})</h2></template>
      <p v-if="!c.bookings.length" class="text-sm text-muted">—</p>
      <ul v-else class="divide-y divide-default">
        <li v-for="b in c.bookings" :key="b.id" class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <NuxtLink :to="`/admin/bookings/${b.id}`" class="font-mono font-medium text-highlighted hover:underline">{{ b.reference }}</NuxtLink>
          <span class="text-muted">{{ b.arrival_date && b.departure_date ? dateRange(b.arrival_date, b.departure_date) : b.arrival_date ? date(b.arrival_date) : '' }}</span>
          <UBadge :label="t(`status.${b.status}`)" color="neutral" variant="subtle" />
          <span class="tabular-nums">{{ money(b.paid_minor, b.currency) }} / {{ money(b.total_minor, b.currency) }}</span>
        </li>
      </ul>
    </UCard>

    <UCard variant="outline">
      <template #header><h2 class="font-medium">{{ t('admin.crm.history') }}</h2></template>
      <ul class="flex flex-col gap-2 text-sm">
        <li v-for="(h, i) in c.history" :key="i" class="flex flex-wrap gap-2">
          <span class="text-muted tabular-nums">{{ dateTime(h.at) }}</span>
          <span class="font-mono text-highlighted">{{ h.action }}</span>
          <span class="text-muted">· {{ h.actor_type }}</span>
        </li>
      </ul>
    </UCard>

    <UModal v-model:open="mergeOpen" :title="t('admin.crm.mergeTitle')" :description="t('admin.crm.mergeText')">
      <template #body>
        <div class="flex flex-col gap-3">
          <UInput v-model="mergeQuery" icon="i-lucide-search" :placeholder="t('admin.crm.search')" :aria-label="t('admin.crm.search')" />
          <URadioGroup v-if="mergeItems.length" v-model="mergeTarget" :items="mergeItems" :legend="t('admin.crm.duplicate')" />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="mergeOpen = false" />
          <UButton :label="t('admin.crm.actions.merge')" :disabled="!mergeTarget" @click="merge" />
        </div>
      </template>
    </UModal>

    <UModal :open="!!viewAs" :title="t('admin.crm.viewAsTitle')" :description="t('admin.crm.viewAsText')" @update:open="(v: boolean) => { if (!v) viewAs = null }">
      <template #body>
        <div v-if="viewAs" class="flex flex-col gap-3 text-sm">
          <UBadge :label="t('admin.crm.readOnly')" color="warning" variant="subtle" class="self-start" />
          <p><strong>{{ (viewAs.account as { email?: string }).email }}</strong></p>
          <ul class="flex flex-col gap-1">
            <li v-for="trip in viewAs.trips" :key="trip.reference">{{ trip.reference }} · {{ t(`status.${trip.status}`) }} · {{ trip.arrival_date ? date(trip.arrival_date) : '' }}</li>
          </ul>
        </div>
      </template>
    </UModal>

    <MzConfirmDialog
      v-model:open="deleteOpen"
      danger
      :title="t('admin.crm.deleteTitle')"
      :description="t('admin.crm.deleteText')"
      :confirm-label="t('admin.crm.actions.delete')"
      @confirm="act(() => admin.crm.deletion(c!.id), t('admin.crm.done')); deleteOpen = false"
    />
  </div>
</template>
