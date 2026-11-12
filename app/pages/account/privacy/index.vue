<script setup lang="ts">
import type { DeletionStatus } from '~/utils/account-types'

/**
 * Privacy: download my data (link by email, valid 7 days) and delete my account (after a grace
 * period, cancellable; not while a stay is upcoming or a balance is unpaid). Bookings and
 * invoices are kept for accounting, without contact details.
 */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const api = useAccountApi()
const toast = useToast()
const reauth = useReauth()
const { date } = useDate()
const localePath = useLocalePath()

const status = ref<DeletionStatus | null>(null)
const exportBusy = ref(false)
const exportSent = ref(false)
async function load() {
  status.value = await api.privacy.deletion()
}
onMounted(load)

async function requestExport() {
  exportBusy.value = true
  try {
    if (await reauth.guard(() => api.privacy.requestExport())) exportSent.value = true
  }
  catch (e) {
    toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
  }
  finally {
    exportBusy.value = false
  }
}

const deleteOpen = ref(false)
const deleteBusy = ref(false)
async function requestDeletion() {
  deleteBusy.value = true
  try {
    await reauth.guard(() => api.privacy.requestDeletion())
    deleteOpen.value = false
    await load()
  }
  catch (e) {
    toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
    deleteOpen.value = false
    await load()
  }
  finally {
    deleteBusy.value = false
  }
}
async function cancelDeletion() {
  await api.privacy.cancelDeletion()
  await load()
  toast.add({ title: t('account.privacy.kept'), color: 'success' })
}
</script>

<template>
  <MzAccountShell :title="t('account.nav.privacy')" :description="t('account.privacy.intro')">
    <section class="flex flex-col gap-3" aria-labelledby="sec-export">
      <h2 id="sec-export" class="font-display text-h3 text-highlighted">{{ t('account.privacy.exportTitle') }}</h2>
      <p class="max-w-prose text-muted">{{ t('account.privacy.exportText') }}</p>
      <UAlert v-if="exportSent" :title="t('account.privacy.exportSent')" color="info" variant="subtle" icon="i-lucide-mail" role="status" />
      <UButton v-else :label="t('account.privacy.exportCta')" icon="i-lucide-download" color="neutral" variant="outline" :loading="exportBusy" class="self-start" @click="requestExport" />
    </section>

    <USeparator />

    <section class="flex flex-col gap-3" aria-labelledby="sec-delete">
      <h2 id="sec-delete" class="font-display text-h3 text-highlighted">{{ t('account.privacy.deleteTitle') }}</h2>
      <p class="max-w-prose text-muted">{{ t('account.privacy.deleteText', { days: status?.grace_days ?? 14 }) }}</p>
      <template v-if="status">
        <UAlert
          v-if="status.scheduled_for"
          :title="t('account.privacy.scheduled', { date: date(status.scheduled_for) })"
          color="warning"
          variant="subtle"
          icon="i-lucide-clock"
          role="status"
        >
          <template #actions>
            <UButton :label="t('account.privacy.keep')" size="sm" @click="cancelDeletion" />
          </template>
        </UAlert>
        <template v-else-if="status.blockers.length">
          <UAlert :title="t('account.privacy.blocked')" color="info" variant="subtle" icon="i-lucide-info">
            <template #description>
              <ul class="list-disc ps-6">
                <li v-for="b in status.blockers" :key="b">{{ t(`account.privacy.blockers.${b}`) }}</li>
              </ul>
            </template>
          </UAlert>
          <UButton :to="localePath('/account/trips')" :label="t('account.nav.trips')" color="neutral" variant="outline" class="self-start" />
        </template>
        <UButton v-else :label="t('account.privacy.deleteCta')" color="error" variant="outline" class="self-start" @click="deleteOpen = true" />
      </template>
    </section>
    <MzConfirmDialog
      v-model:open="deleteOpen"
      danger
      :title="t('account.privacy.deleteConfirm')"
      :description="t('account.privacy.deleteConfirmText', { days: status?.grace_days ?? 14 })"
      :confirm-label="t('account.privacy.deleteCta')"
      :loading="deleteBusy"
      @confirm="requestDeletion"
    />
  </MzAccountShell>
</template>
