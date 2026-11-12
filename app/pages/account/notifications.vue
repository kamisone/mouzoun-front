<script setup lang="ts">
import type { NotificationCategory, NotificationChannel, NotificationPrefs } from '~/utils/account-types'

/**
 * Notifications by topic and channel. Booking updates and security emails are always sent.
 * "Offers by email" is the newsletter / marketing consent itself.
 */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const api = useAccountApi()
const toast = useToast()
const prefs = ref<NotificationPrefs | null>(null)
onMounted(async () => {
  prefs.value = (await api.notifications()).preferences
})
const categories: NotificationCategory[] = ['reminders', 'reviews', 'offers']
const channels: NotificationChannel[] = ['email', 'whatsapp', 'sms']

async function set(category: NotificationCategory, channel: NotificationChannel, enabled: boolean) {
  if (!prefs.value) return
  const before = prefs.value[category][channel]
  prefs.value[category][channel] = enabled
  try {
    await api.setNotification(category, channel, enabled)
  }
  catch {
    prefs.value[category][channel] = before
    toast.add({ title: t('account.errors.generic'), color: 'error' })
  }
}
</script>

<template>
  <MzAccountShell :title="t('account.nav.notifications')" :description="t('account.notifications.intro')">
    <MzSkeleton v-if="!prefs" class="h-48" />
    <template v-else>
      <fieldset v-for="c in categories" :key="c" class="flex flex-col gap-3 rounded-sm p-6 ring ring-default">
        <legend class="px-1 font-medium text-highlighted">{{ t(`account.notifications.${c}`) }}</legend>
        <p class="text-small text-muted">{{ t(`account.notifications.${c}Text`) }}</p>
        <div class="flex flex-wrap gap-6">
          <USwitch
            v-for="ch in channels"
            :key="ch"
            :model-value="prefs[c][ch]"
            :label="t(`account.notifications.channels.${ch}`)"
            @update:model-value="(v: boolean) => set(c, ch, v)"
          />
        </div>
      </fieldset>
      <p class="text-small text-muted">{{ t('account.notifications.alwaysOn') }}</p>
    </template>
  </MzAccountShell>
</template>
