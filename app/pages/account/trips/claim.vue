<script setup lang="ts">
/**
 * "Add a booking to my account": the booking reference and the email it was made with. A link
 * goes to that address; the booking joins the account once the link is opened (?token=...).
 */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const api = useAccountApi()

const form = reactive({ reference: typeof route.query.reference === 'string' ? route.query.reference : '', email: '' })
const busy = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)
const claimed = ref<string | null>(null)

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string') return
  await router.replace({ query: {} })
  busy.value = true
  try {
    claimed.value = (await api.confirmClaim(token)).reference
  }
  catch (e) {
    error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    busy.value = false
  }
})

async function submit() {
  error.value = null
  if (!/^MZ-\d{2}-\d{6,}$/i.test(form.reference.trim()) || !isEmail(form.email)) {
    error.value = t('account.claim.invalid')
    return
  }
  busy.value = true
  try {
    await api.claim(form.reference.trim(), form.email.trim())
    sent.value = true
  }
  catch (e) {
    error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <MzAccountShell :title="t('account.claim.title')" :description="t('account.claim.intro')">
    <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
    <UAlert
      v-if="claimed"
      :title="t('account.claim.done', { reference: claimed })"
      color="success"
      variant="subtle"
      icon="i-lucide-circle-check"
      role="status"
    >
      <template #actions>
        <UButton :to="localePath(`/booking/${claimed}`)" :label="t('account.trips.manage')" size="sm" />
      </template>
    </UAlert>
    <UAlert v-else-if="sent" :title="t('account.claim.sent')" :description="t('account.claim.sentText')" color="info" variant="subtle" icon="i-lucide-mail" role="status" />
    <form v-else class="flex max-w-md flex-col gap-4" novalidate @submit.prevent="submit">
      <UFormField :label="t('account.claim.reference')" :help="t('account.claim.referenceHelp')" required>
        <UInput v-model="form.reference" autocomplete="off" autocapitalize="characters" class="w-full" placeholder="MZ-26-000123" />
      </UFormField>
      <UFormField :label="t('account.claim.email')" required>
        <UInput v-model="form.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UButton type="submit" :label="t('account.claim.submit')" :loading="busy" class="self-start" />
    </form>
  </MzAccountShell>
</template>
