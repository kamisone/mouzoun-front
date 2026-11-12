<script setup lang="ts">
import { getPasskey, passkeysSupported } from '~/utils/webauthn'

/**
 * "Confirm it's you" (sensitive actions after 10 minutes): a code by email, the password, or a
 * passkey. Opened by useReauth().guard(); the action is retried after success.
 */
const { t } = useI18n()
const api = useAccountApi()
const { account } = useAccount()
const { open, done } = useReauth()

const code = ref('')
const password = ref('')
const mode = ref<'choose' | 'code' | 'password'>('choose')
const busy = ref(false)
const error = ref<string | null>(null)
const canPasskey = ref(false)
onMounted(() => { canPasskey.value = passkeysSupported() })

watch(open, (v) => {
  if (v) {
    mode.value = 'choose'
    code.value = ''
    password.value = ''
    error.value = null
  }
})

async function run(fn: () => Promise<unknown>) {
  busy.value = true
  error.value = null
  try {
    await fn()
    return true
  }
  catch (e) {
    const name = (e as Error).name
    if (name !== 'NotAllowedError' && name !== 'AbortError') error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
    return false
  }
  finally {
    busy.value = false
  }
}

async function sendCode() {
  if (await run(() => api.auth.reauthSend())) mode.value = 'code'
}
async function confirmCode(value = code.value) {
  if (value.length === 6 && await run(() => api.auth.reauth({ code: value }))) done(true)
  else code.value = ''
}
async function confirmPassword() {
  if (await run(() => api.auth.reauth({ password: password.value }))) done(true)
}
async function confirmPasskey() {
  if (await run(async () => api.auth.reauthPasskey(await getPasskey(await api.auth.reauthPasskeyOptions())))) done(true)
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('account.reauth.title')"
    :description="t('account.reauth.description')"
    @update:open="(v: boolean) => { if (!v) done(false) }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
        <template v-if="mode === 'choose'">
          <UButton :label="t('account.reauth.emailCode', { email: account?.email ?? '' })" icon="i-lucide-mail" :loading="busy" block @click="sendCode" />
          <UButton v-if="account?.has_password" :label="t('account.reauth.password')" icon="i-lucide-key" color="neutral" variant="outline" block @click="mode = 'password'" />
          <UButton v-if="canPasskey" :label="t('account.reauth.passkey')" icon="i-lucide-fingerprint" color="neutral" variant="outline" block :disabled="busy" @click="confirmPasskey" />
        </template>
        <form v-else-if="mode === 'code'" class="flex flex-col gap-4" @submit.prevent="confirmCode()">
          <MzCodeInput v-model="code" :label="t('account.code.label')" :invalid="!!error" :disabled="busy" @complete="confirmCode" />
          <UButton type="submit" :label="t('account.signin.verify')" :loading="busy" :disabled="code.length !== 6" block />
        </form>
        <form v-else class="flex flex-col gap-4" @submit.prevent="confirmPassword">
          <input type="email" :value="account?.email" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
          <UFormField :label="t('account.signin.password')" required>
            <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" />
          </UFormField>
          <UButton type="submit" :label="t('account.reauth.confirm')" :loading="busy" block />
        </form>
      </div>
    </template>
  </UModal>
</template>
