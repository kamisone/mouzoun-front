<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import type { MfaChallenge } from '~/composables/useAuth'

definePageMeta({ layout: 'auth', middleware: 'admin-auth', i18n: false })

const { t } = useI18n()
const { login, verifyMfa } = useAuth()
const route = useRoute()
const v = useValidation()

const schema = computed(() => z.object({ email: v.email(), password: v.required() }))
type Schema = z.output<typeof schema.value>
const state = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)
const challenge = ref<MfaChallenge | null>(null)
const code = ref('')
const codeInput = ref<{ focus: () => void } | null>(null)

useHead({ title: () => t('auth.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const redirect = () => (typeof route.query.redirect === 'string' && /^\/(?:admin|_styleguide)(?:[/?]|$)/.test(route.query.redirect) ? route.query.redirect : '/admin')

function message(e: unknown) {
  const status = (e as { statusCode?: number }).statusCode
  const code = apiErrorCode(e)
  if ((e as Error).message === 'forbidden') return t('auth.forbidden')
  if (code === 'invalid_code' || code === 'mfa_invalid') return t('auth.mfa.invalid')
  if (code === 'mfa_expired' || code === 'too_many_attempts') return t('auth.mfa.expired')
  if (status === 429) return t('auth.tooMany')
  if (status === 401 || status === 400 || status === 422) return t('auth.invalid')
  return t('auth.error')
}

async function submit(event: FormSubmitEvent<Schema>) {
  error.value = ''
  loading.value = true
  try {
    challenge.value = await login(event.data.email, event.data.password)
    if (!challenge.value) return await navigateTo(redirect())
    await nextTick()
    codeInput.value?.focus()
  }
  catch (e: unknown) {
    error.value = message(e)
  }
  finally {
    loading.value = false
  }
}

async function verify(value = code.value) {
  if (!challenge.value || value.length !== 6) return
  error.value = ''
  loading.value = true
  try {
    await verifyMfa(challenge.value.mfa_token, value)
    await navigateTo(redirect())
  }
  catch (e) {
    error.value = message(e)
    code.value = ''
    if (['mfa_expired', 'too_many_attempts'].includes(apiErrorCode(e))) challenge.value = null
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-2xl font-semibold">{{ challenge ? t('auth.mfa.title') : t('auth.title') }}</h1>
      <p class="mt-1 text-sm text-muted">
        {{ challenge?.mfa_enrollment_required ? t('auth.mfa.enrol') : challenge ? t('auth.mfa.subtitle') : t('auth.subtitle') }}
      </p>
    </div>
    <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

    <UForm v-if="!challenge" :schema="schema" :state="state" class="flex flex-col gap-4" @submit="submit">
      <MzFormField name="email" :label="t('auth.email')" required>
        <UInput v-model="state.email" type="email" autocomplete="username" class="w-full" />
      </MzFormField>
      <MzFormField name="password" :label="t('auth.password')" required>
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </MzFormField>
      <UButton type="submit" :label="t('auth.submit')" :loading="loading" block size="lg" />
    </UForm>

    <form v-else class="flex flex-col gap-4" @submit.prevent="verify()">
      <template v-if="challenge.mfa_enrollment_required && challenge.otpauth_uri">
        <MzQrCode :value="challenge.otpauth_uri" :label="t('auth.mfa.qr')" class="mx-auto max-w-48" />
        <p class="text-center text-xs text-muted">
          {{ t('auth.mfa.manual') }}
          <code class="block pt-1 font-mono text-sm break-all text-highlighted" dir="ltr">{{ challenge.secret }}</code>
        </p>
      </template>
      <MzCodeInput ref="codeInput" v-model="code" :label="t('auth.mfa.code')" :invalid="!!error" :disabled="loading" @complete="verify" />
      <UButton type="submit" :label="t('auth.mfa.verify')" :loading="loading" :disabled="code.length !== 6" block size="lg" />
      <UButton :label="t('auth.mfa.back')" color="neutral" variant="link" class="self-center" @click="challenge = null; code = ''; error = ''" />
    </form>
  </div>
</template>
