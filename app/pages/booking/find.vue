<script setup lang="ts">
import { isEmail } from '~/utils/contact'

/**
 * "Find my booking": reference + email. Never shows any data here: when they match, a
 * single-use link goes to the booking's email address. Same answer either way.
 */
const { t } = useI18n()
const api = useBookingApi()
useSeo({ title: () => `${t('booking.find.title')} · ${t('common.siteName')}`, description: () => t('booking.find.text') })

const reference = ref('')
const email = ref('')
const sent = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const valid = computed(() => /^MZ-\d{2}-\d{1,9}$/i.test(reference.value.trim()) && isEmail(email.value))

async function submit() {
  if (!valid.value) {
    error.value = t('booking.find.invalid')
    return
  }
  busy.value = true
  error.value = null
  try {
    await api.booking.find({ reference: reference.value.trim().toUpperCase(), email: email.value.trim() })
    sent.value = true
  }
  catch (e) {
    error.value = t(`booking.errors.${apiErrorCode(e)}`, t('booking.errors.generic'))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <MzContainer size="narrow" class="pt-16 pb-24">
    <div class="mx-auto flex max-w-md flex-col gap-6">
      <h1 class="text-display-lg">{{ t('booking.find.title') }}</h1>
      <p class="text-muted">{{ t('booking.find.text') }}</p>
      <div v-if="sent" role="status" class="rounded-sm bg-muted p-6" data-testid="find-sent">
        <p class="font-medium text-highlighted">{{ t('booking.find.sent') }}</p>
        <p class="text-small text-muted">{{ t('booking.find.sentText') }}</p>
      </div>
      <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
        <UFormField :label="t('booking.find.reference')" :help="t('booking.find.referenceHelp')">
          <UInput v-model="reference" placeholder="MZ-26-000123" autocomplete="off" class="w-full" dir="ltr" />
        </UFormField>
        <UFormField :label="t('booking.checkout.email')">
          <UInput v-model="email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <p v-if="error" role="alert" class="text-small text-error">{{ error }}</p>
        <UButton type="submit" :label="t('booking.find.cta')" :loading="busy" size="lg" block />
      </form>
    </div>
  </MzContainer>
</template>
