<script setup lang="ts">
/**
 * Back-office settings of the signed-in staff member. Two-step verification is a personal
 * choice: turning it on shows a QR code (and the key, to type by hand) and needs a first code
 * from the app; once on, every sign-in asks for a code. Turning it off needs a current code.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.settings' })
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()
const { dateTime } = useDate()

const { data: status, error: loadError } = await useAsyncData('admin-mfa', () => admin.mfa.status())
type Mode = 'idle' | 'setup' | 'disable'
const mode = ref<Mode>('idle')
const setup = ref<{ secret: string, otpauth_uri: string } | null>(null)
const code = ref('')
const error = ref('')
const busy = ref(false)
const codeInput = ref<{ focus: () => void } | null>(null)

function message(e: unknown) {
  const code = apiErrorCode(e)
  if (code === 'invalid_code') return t('auth.mfa.invalid')
  if (code === 'mfa_setup_expired') return t('admin.account.mfa.setupExpired')
  if ((e as { statusCode?: number }).statusCode === 429) return t('auth.tooMany')
  return t('auth.error')
}

async function open(next: Mode) {
  error.value = ''
  code.value = ''
  busy.value = true
  try {
    if (next === 'setup') setup.value = await admin.mfa.setup()
    mode.value = next
    await nextTick()
    codeInput.value?.focus()
  }
  catch (e) {
    error.value = message(e)
  }
  finally {
    busy.value = false
  }
}

function cancel() {
  mode.value = 'idle'
  setup.value = null
  code.value = ''
  error.value = ''
}

async function confirm(value = code.value) {
  if (value.length !== 6 || busy.value) return
  error.value = ''
  busy.value = true
  try {
    const enabling = mode.value === 'setup'
    status.value = enabling ? await admin.mfa.enable(value) : await admin.mfa.disable(value)
    cancel()
    toast.add({ title: enabling ? t('admin.account.mfa.enabled') : t('admin.account.mfa.disabled'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    error.value = message(e)
    code.value = ''
    if (apiErrorCode(e) === 'mfa_setup_expired') {
      mode.value = 'idle'
      setup.value = null
    }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <MzPageHeader :title="t('admin.settings')" :description="t('admin.account.description')" />

    <UAlert v-if="loadError" :title="t('auth.error')" color="error" variant="subtle" role="alert" />
    <MzSkeleton v-else-if="!status" variant="card" />
    <UCard v-else variant="outline" data-testid="mfa-card">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <h2 class="font-display text-lg font-semibold">{{ t('auth.mfa.title') }}</h2>
            <p class="text-sm text-muted">{{ t('admin.account.mfa.help') }}</p>
          </div>
          <UBadge
            :label="status.enabled ? t('admin.account.mfa.on') : t('admin.account.mfa.off')"
            :color="status.enabled ? 'success' : 'neutral'"
            variant="subtle"
            data-testid="mfa-status"
          />
        </div>
        <p v-if="status.enabled && status.enabled_at" class="text-sm text-muted">
          {{ t('admin.account.mfa.since', { date: dateTime(status.enabled_at) }) }}
        </p>

        <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

        <div v-if="mode === 'idle'">
          <UButton
            v-if="status.enabled"
            :label="t('admin.account.mfa.turnOff')"
            color="error"
            variant="outline"
            :loading="busy"
            @click="open('disable')"
          />
          <UButton v-else :label="t('admin.account.mfa.turnOn')" icon="i-lucide-shield-check" :loading="busy" @click="open('setup')" />
        </div>

        <form v-else class="flex flex-col gap-4" @submit.prevent="confirm()">
          <template v-if="mode === 'setup' && setup">
            <p class="text-sm">{{ t('auth.mfa.enrol') }}</p>
            <MzQrCode :value="setup.otpauth_uri" :label="t('auth.mfa.qr')" class="max-w-48" />
            <p class="text-xs text-muted">
              {{ t('auth.mfa.manual') }}
              <code class="block pt-1 font-mono text-sm break-all text-highlighted" dir="ltr" data-testid="mfa-secret">{{ setup.secret }}</code>
            </p>
          </template>
          <p v-else class="text-sm">{{ t('admin.account.mfa.disableHelp') }}</p>
          <MzCodeInput ref="codeInput" v-model="code" :label="t('auth.mfa.code')" :invalid="!!error" :disabled="busy" @complete="confirm" />
          <div class="flex flex-wrap gap-2">
            <UButton
              type="submit"
              :label="mode === 'setup' ? t('admin.account.mfa.confirmOn') : t('admin.account.mfa.confirmOff')"
              :color="mode === 'setup' ? 'primary' : 'error'"
              :loading="busy"
              :disabled="code.length !== 6"
            />
            <UButton :label="t('admin.account.mfa.cancel')" color="neutral" variant="ghost" @click="cancel" />
          </div>
        </form>
      </div>
    </UCard>
  </div>
</template>
