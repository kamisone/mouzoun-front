<script setup lang="ts">
import type { IdentifyResult, Provider, SignInResult } from '~/utils/account-types'
import { conditionalSupported, getPasskey, passkeysSupported } from '~/utils/webauthn'
import { isEmail } from '~/utils/contact'

/**
 * "Sign in or create an account": one flow for both. Email → a 6-digit code (and a link in the
 * same email), or a password, a passkey, Google or Apple. Never says whether an account exists.
 * New accounts are asked only for their name (and, unticked, for offers by email).
 */
const props = withDefaults(defineProps<{
  /** Relative path to come back to after a provider (Google / Apple) round trip. */
  returnTo?: string
  /** Prefills the email (checkout, booking confirmation). */
  email?: string
  /** Heading level of the title (2 inside a page, none in a dialog). */
  headingLevel?: 1 | 2 | 0
  /** Sends the code to `email` at once (one tap from a booking confirmation). */
  autoSend?: boolean
}>(), { returnTo: undefined, email: '', headingLevel: 1, autoSend: false })
const emit = defineEmits<{ 'signed-in': [result: SignInResult] }>()

const { t } = useI18n()
const api = useAccountApi()
const { signedIn, account: accountState } = useAccount()
const captcha = useCaptcha()
const route = useRoute()
const id = useId()

type Step = 'email' | 'code' | 'password' | 'profile'
const step = ref<Step>('email')
const email = ref(props.email)
const sharedDevice = ref(false)
const code = ref('')
const password = ref('')
const sent = ref<IdentifyResult | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const emailError = ref<string | null>(null)
const resendIn = ref(0)
const providers = ref<Record<Provider, boolean>>({ google: false, apple: false })
const canPasskey = ref(false)
const codeInput = ref<{ focus: () => void } | null>(null)
const heading = ref<HTMLElement | null>(null)
let conditional: AbortController | null = null
let timer: ReturnType<typeof setInterval> | null = null

const profile = reactive({ first_name: '', last_name: '', marketing_consent: false })
let pending: SignInResult | null = null

const returnTo = computed(() => props.returnTo ?? (typeof route.query.return_to === 'string' ? route.query.return_to : undefined))

onMounted(async () => {
  providers.value = await api.auth.providers().catch(() => ({ google: false, apple: false }))
  canPasskey.value = passkeysSupported()
  const oauthError = route.query.error
  if (typeof oauthError === 'string') error.value = t(`account.errors.${oauthError}`, t('account.errors.generic'))
  if (props.autoSend && isEmail(email.value)) await sendCode()
  else if (await conditionalSupported()) startConditional()
})
onBeforeUnmount(() => {
  conditional?.abort()
  if (timer) clearInterval(timer)
})

async function focusStep() {
  await nextTick()
  heading.value?.focus()
}

/** Passkeys proposed by the browser's autofill on the email field. */
async function startConditional() {
  conditional?.abort()
  conditional = new AbortController()
  try {
    const options = await api.auth.passkeyOptions()
    const credential = await getPasskey(options, { conditional: true, signal: conditional.signal })
    await finish(await api.auth.passkey(credential, sharedDevice.value))
  }
  catch (e) {
    if ((e as Error).name !== 'AbortError' && apiErrorCode(e) !== 'network_error') error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
}

async function usePasskey() {
  error.value = null
  conditional?.abort()
  busy.value = true
  try {
    const options = await api.auth.passkeyOptions()
    const credential = await getPasskey(options)
    await finish(await api.auth.passkey(credential, sharedDevice.value))
  }
  catch (e) {
    const name = (e as Error).name
    if (name !== 'NotAllowedError' && name !== 'AbortError') error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    busy.value = false
  }
}

function startResendTimer(seconds: number) {
  resendIn.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    resendIn.value = Math.max(0, resendIn.value - 1)
    if (!resendIn.value && timer) clearInterval(timer)
  }, 1000)
}

async function sendCode() {
  emailError.value = null
  error.value = null
  if (!isEmail(email.value)) {
    emailError.value = t('validation.email')
    return
  }
  busy.value = true
  try {
    sent.value = await api.auth.identify(email.value.trim(), returnTo.value, await captcha.token(`${id}-captcha`))
    conditional?.abort()
    code.value = ''
    step.value = 'code'
    startResendTimer(sent.value.resend_after_seconds)
  }
  catch (e) {
    error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    busy.value = false
  }
  // The boxes are enabled again only now: focus the first one.
  if (step.value === 'code') {
    await nextTick()
    codeInput.value?.focus()
  }
}

const attemptsLeft = ref<number | null>(null)
async function verifyCode(value = code.value) {
  if (value.length !== 6 || busy.value) return
  error.value = null
  busy.value = true
  try {
    await finish(await api.auth.code(email.value.trim(), value, sharedDevice.value))
  }
  catch (e) {
    const c = apiErrorCode(e)
    attemptsLeft.value = apiErrorDetails<{ attempts_left?: number }>(e)?.attempts_left ?? null
    error.value = c === 'invalid_code' && attemptsLeft.value !== null
      ? t('account.errors.invalid_code_left', { n: attemptsLeft.value }, attemptsLeft.value)
      : t(`account.errors.${c}`, t('account.errors.generic'))
    code.value = ''
    if (c === 'too_many_attempts' || c === 'code_expired') resendIn.value = 0
  }
  finally {
    busy.value = false
  }
  if (error.value) {
    await nextTick()
    codeInput.value?.focus()
  }
}

async function signInWithPassword() {
  error.value = null
  if (!password.value) {
    error.value = t('validation.required')
    return
  }
  busy.value = true
  try {
    await finish(await api.auth.password(email.value.trim(), password.value, sharedDevice.value))
  }
  catch (e) {
    error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    busy.value = false
  }
}

async function finish(result: SignInResult) {
  if (result.needs_profile) {
    pending = result
    profile.first_name = result.account.first_name
    profile.last_name = result.account.last_name ?? ''
    step.value = 'profile'
    await signedIn(result)
    await focusStep()
    return
  }
  await signedIn(result)
  emit('signed-in', result)
}

const profileErrors = reactive<{ first_name?: string, last_name?: string }>({})
async function saveProfile() {
  profileErrors.first_name = profile.first_name.trim() ? undefined : t('validation.required')
  profileErrors.last_name = profile.last_name.trim() ? undefined : t('validation.required')
  if (profileErrors.first_name || profileErrors.last_name || !pending) return
  busy.value = true
  try {
    const account = await api.update({ first_name: profile.first_name.trim(), last_name: profile.last_name.trim(), marketing_consent: profile.marketing_consent })
    const result = { ...pending, account }
    accountState.value = account
    emit('signed-in', result)
  }
  catch (e) {
    error.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    busy.value = false
  }
}

function back() {
  error.value = null
  step.value = 'email'
  if (canPasskey.value) startConditional()
}

const title = computed(() => ({
  email: t('account.signin.title'),
  code: t('account.signin.codeTitle'),
  password: t('account.signin.passwordTitle'),
  profile: t('account.signin.profileTitle'),
}[step.value]))
const tag = computed(() => (props.headingLevel ? `h${props.headingLevel}` : 'p'))
const errorId = `${id}-error`
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="signin-panel">
    <div class="flex flex-col gap-2">
      <component :is="tag" ref="heading" tabindex="-1" class="font-display text-h2 text-highlighted outline-none">{{ title }}</component>
      <p v-if="step === 'email'" class="text-small text-muted">{{ t('account.signin.intro') }}</p>
      <p v-else-if="step === 'code' && sent" class="text-small text-muted" aria-live="polite">
        {{ t('account.signin.codeSent', { email: sent.masked_email, minutes: sent.code_minutes }) }}
      </p>
      <p v-else-if="step === 'profile'" class="text-small text-muted">{{ t('account.signin.profileIntro') }}</p>
    </div>

    <UAlert v-if="error" :id="errorId" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

    <!-- 1. Email (and the other ways in) -->
    <form v-if="step === 'email'" class="flex flex-col gap-4" novalidate @submit.prevent="sendCode">
      <div v-if="providers.google || providers.apple" class="flex flex-col gap-2">
        <UButton
          v-if="providers.google"
          :href="api.auth.oauthUrl('google', { returnTo, sharedDevice })"
          external
          icon="i-simple-icons-google"
          :label="t('account.signin.google')"
          color="neutral"
          variant="outline"
          size="lg"
          block
        />
        <UButton
          v-if="providers.apple"
          :href="api.auth.oauthUrl('apple', { returnTo, sharedDevice })"
          external
          icon="i-simple-icons-apple"
          :label="t('account.signin.apple')"
          color="neutral"
          variant="outline"
          size="lg"
          block
        />
        <USeparator :label="t('account.signin.or')" class="my-2" />
      </div>
      <UFormField :label="t('account.signin.email')" :error="emailError ?? undefined" required>
        <UInput
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="username webauthn"
          autocapitalize="off"
          spellcheck="false"
          size="lg"
          class="w-full"
          data-testid="signin-email"
        />
      </UFormField>
      <UCheckbox v-model="sharedDevice" :label="t('account.signin.sharedDevice')" :description="t('account.signin.sharedDeviceHint')" />
      <div :id="`${id}-captcha`" />
      <UButton type="submit" :label="t('account.signin.continue')" :loading="busy" size="lg" block data-testid="signin-continue" />
      <UButton
        v-if="canPasskey"
        :label="t('account.signin.passkey')"
        icon="i-lucide-key-round"
        color="neutral"
        variant="ghost"
        block
        :disabled="busy"
        @click="usePasskey"
      />
      <p class="text-caption text-muted">{{ t('account.signin.legal') }}</p>
    </form>

    <!-- 2a. Code -->
    <form v-else-if="step === 'code'" class="flex flex-col gap-4" novalidate @submit.prevent="verifyCode()">
      <MzCodeInput
        ref="codeInput"
        v-model="code"
        :label="t('account.code.label')"
        :invalid="!!error"
        :disabled="busy"
        :describedby="error ? errorId : undefined"
        @complete="verifyCode"
      />
      <p class="text-caption text-muted">{{ t('account.signin.codeHint') }}</p>
      <UButton type="submit" :label="t('account.signin.verify')" :loading="busy" :disabled="code.length !== 6" size="lg" block data-testid="signin-verify" />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UButton
          :label="resendIn ? t('account.signin.resendIn', { s: resendIn }) : t('account.signin.resend')"
          :disabled="resendIn > 0 || busy"
          color="neutral"
          variant="link"
          @click="sendCode"
        />
        <UButton :label="t('account.signin.usePassword')" color="neutral" variant="link" @click="step = 'password'; error = null" />
      </div>
      <UButton :label="t('account.signin.otherEmail')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" class="self-start" @click="back" />
    </form>

    <!-- 2b. Password -->
    <form v-else-if="step === 'password'" class="flex flex-col gap-4" novalidate @submit.prevent="signInWithPassword">
      <input type="email" :value="email" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
      <UFormField :label="t('account.signin.password')" required>
        <UInput v-model="password" type="password" autocomplete="current-password" size="lg" class="w-full" />
      </UFormField>
      <UButton type="submit" :label="t('account.signin.signIn')" :loading="busy" size="lg" block />
      <UButton :label="t('account.signin.useCode')" color="neutral" variant="link" class="self-start" @click="step = 'code'; error = null; sendCode()" />
    </form>

    <!-- 3. New account: names only -->
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="saveProfile">
      <UFormField :label="t('account.profile.firstName')" :error="profileErrors.first_name" required>
        <UInput v-model="profile.first_name" autocomplete="given-name" size="lg" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.lastName')" :error="profileErrors.last_name" required>
        <UInput v-model="profile.last_name" autocomplete="family-name" size="lg" class="w-full" />
      </UFormField>
      <UCheckbox v-model="profile.marketing_consent" :label="t('account.profile.offersConsent')" />
      <UButton type="submit" :label="t('account.signin.finish')" :loading="busy" size="lg" block data-testid="signin-finish" />
    </form>
  </div>
</template>
