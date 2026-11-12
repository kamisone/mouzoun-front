<script setup lang="ts">
import type { Passkey, Provider, SessionView } from '~/utils/account-types'
import { createPasskey, passkeysSupported } from '~/utils/webauthn'

/**
 * Login & security: email, password, passkeys, Google / Apple, and where you are signed in.
 * Changes need a recent confirmation (the dialog asks for it when needed) and each one sends a
 * security email.
 */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const api = useAccountApi()
const toast = useToast()
const reauth = useReauth()
const { account, signOut } = useAccount()
const { dateTime } = useDate()

const sessions = ref<SessionView[]>([])
const passkeys = ref<Passkey[]>([])
const providers = ref<Record<Provider, boolean>>({ google: false, apple: false })
const canPasskey = ref(false)
const banner = ref<{ title: string, color: 'success' | 'error' } | null>(null)

async function loadSessions() {
  sessions.value = (await api.sessions().catch(() => ({ sessions: [] }))).sessions
}
async function loadPasskeys() {
  passkeys.value = (await api.passkeys.list().catch(() => ({ passkeys: [] }))).passkeys
}
onMounted(async () => {
  canPasskey.value = passkeysSupported()
  await Promise.all([loadSessions(), loadPasskeys(), api.auth.providers().then((p) => { providers.value = p }).catch(() => {})])
  if (route.query.linked) banner.value = { title: t('account.security.linked'), color: 'success' }
  if (typeof route.query.error === 'string') banner.value = { title: t(`account.errors.${route.query.error}`, t('account.errors.generic')), color: 'error' }
})

function fail(e: unknown) {
  toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
}
function ok(title: string) {
  toast.add({ title, color: 'success', icon: 'i-lucide-check' })
}

// ---- Email
const newEmail = ref('')
const emailStep = ref<'idle' | 'code'>('idle')
const emailCode = ref('')
const emailBusy = ref(false)
const emailError = ref<string | null>(null)
async function requestEmail() {
  emailError.value = null
  if (!isEmail(newEmail.value)) {
    emailError.value = t('validation.email')
    return
  }
  emailBusy.value = true
  try {
    const done = await reauth.guard(() => api.requestEmailChange(newEmail.value.trim()).then(() => true))
    if (done) emailStep.value = 'code'
  }
  catch (e) {
    emailError.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    emailBusy.value = false
  }
}
async function confirmEmail(code = emailCode.value) {
  if (code.length !== 6) return
  emailBusy.value = true
  emailError.value = null
  try {
    account.value = await api.confirmEmailChange(code)
    emailStep.value = 'idle'
    newEmail.value = ''
    ok(t('account.security.emailChanged'))
  }
  catch (e) {
    emailCode.value = ''
    emailError.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    emailBusy.value = false
  }
}

// ---- Password
const password = ref('')
const passwordError = ref<string | null>(null)
const passwordBusy = ref(false)
async function savePassword() {
  passwordError.value = password.value.length < 10 ? t('account.errors.password_too_short') : null
  if (passwordError.value) return
  passwordBusy.value = true
  try {
    const done = await reauth.guard(() => api.setPassword(password.value).then(() => true))
    if (done) {
      password.value = ''
      if (account.value) account.value.has_password = true
      ok(t('account.security.passwordSaved'))
      await loadSessions()
    }
  }
  catch (e) {
    passwordError.value = t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic'))
  }
  finally {
    passwordBusy.value = false
  }
}
async function removePassword() {
  try {
    const done = await reauth.guard(() => api.removePassword().then(() => true))
    if (done && account.value) {
      account.value.has_password = false
      ok(t('account.security.passwordRemoved'))
    }
  }
  catch (e) {
    fail(e)
  }
}

// ---- Passkeys
const passkeyBusy = ref(false)
async function addPasskey() {
  passkeyBusy.value = true
  try {
    const options = await reauth.guard(() => api.passkeys.options())
    if (!options) return
    const credential = await createPasskey(options)
    await api.passkeys.add(credential)
    await loadPasskeys()
    ok(t('account.security.passkeyAdded'))
  }
  catch (e) {
    const name = (e as Error).name
    if (name !== 'NotAllowedError' && name !== 'AbortError') fail(e)
  }
  finally {
    passkeyBusy.value = false
  }
}
async function removePasskey(p: Passkey) {
  try {
    if (await reauth.guard(() => api.passkeys.remove(p.id).then(() => true))) await loadPasskeys()
  }
  catch (e) {
    fail(e)
  }
}

// ---- Google / Apple
const linked = (p: Provider) => account.value?.identities.find(i => i.provider === p)
async function link(p: Provider) {
  // The provider round trip needs a recent confirmation: ask first, then leave the page.
  if (!(await reauth.ask())) return
  window.location.assign(api.auth.oauthUrl(p, { link: true, returnTo: route.path }))
}
async function unlink(p: Provider) {
  try {
    if (await reauth.guard(() => api.unlink(p).then(() => true))) {
      if (account.value) account.value.identities = account.value.identities.filter(i => i.provider !== p)
      ok(t('account.security.unlinked'))
    }
  }
  catch (e) {
    fail(e)
  }
}

// ---- Sessions
async function revoke(s: SessionView) {
  await api.revokeSession(s.id).catch(fail)
  await loadSessions()
}
const everywhereOpen = ref(false)
async function signOutEverywhere() {
  await signOut(true)
  await navigateTo(localePath('/account/signin'))
}
const device = (ua: string | null) => {
  if (!ua) return t('account.security.unknownDevice')
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return [browser, os].filter(Boolean).join(' · ') || t('account.security.unknownDevice')
}
</script>

<template>
  <MzAccountShell :title="t('account.nav.security')" :description="t('account.security.intro')">
    <UAlert v-if="banner" :title="banner.title" :color="banner.color" variant="subtle" role="status" />

    <section id="email" class="flex flex-col gap-4" aria-labelledby="sec-email">
      <h2 id="sec-email" class="font-display text-h3 text-highlighted">{{ t('account.security.email') }}</h2>
      <p class="text-muted">{{ t('account.security.emailCurrent') }} <strong class="text-highlighted" dir="ltr">{{ account?.email }}</strong></p>
      <UAlert v-if="emailError" :title="emailError" color="error" variant="subtle" role="alert" />
      <form v-if="emailStep === 'idle'" class="flex max-w-md flex-wrap items-end gap-2" novalidate @submit.prevent="requestEmail">
        <UFormField :label="t('account.security.newEmail')" class="flex-1">
          <UInput v-model="newEmail" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UButton type="submit" :label="t('account.security.sendCode')" :loading="emailBusy" />
      </form>
      <form v-else class="flex max-w-md flex-col gap-3" @submit.prevent="confirmEmail()">
        <p class="text-small text-muted">{{ t('account.security.emailCodeSent', { email: newEmail }) }}</p>
        <MzCodeInput v-model="emailCode" :label="t('account.code.label')" :invalid="!!emailError" :disabled="emailBusy" @complete="confirmEmail" />
        <div class="flex gap-2">
          <UButton type="submit" :label="t('account.signin.verify')" :loading="emailBusy" :disabled="emailCode.length !== 6" />
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="emailStep = 'idle'" />
        </div>
      </form>
    </section>

    <USeparator />

    <section class="flex flex-col gap-4" aria-labelledby="sec-password">
      <h2 id="sec-password" class="font-display text-h3 text-highlighted">{{ t('account.security.password') }}</h2>
      <p class="text-muted">{{ account?.has_password ? t('account.security.passwordSet') : t('account.security.passwordNone') }}</p>
      <form class="flex max-w-md flex-col gap-3" novalidate @submit.prevent="savePassword">
        <input type="email" :value="account?.email" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
        <UFormField :label="account?.has_password ? t('account.security.newPassword') : t('account.security.choosePassword')" :help="t('account.security.passwordRules')" :error="passwordError ?? undefined">
          <UInput v-model="password" type="password" autocomplete="new-password" minlength="10" class="w-full" />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton type="submit" :label="t('common.save')" :loading="passwordBusy" />
          <UButton v-if="account?.has_password" :label="t('account.security.removePassword')" color="neutral" variant="ghost" @click="removePassword" />
        </div>
      </form>
    </section>

    <USeparator />

    <section class="flex flex-col gap-4" aria-labelledby="sec-passkeys">
      <h2 id="sec-passkeys" class="font-display text-h3 text-highlighted">{{ t('account.security.passkeys') }}</h2>
      <p class="max-w-prose text-muted">{{ t('account.security.passkeysIntro') }}</p>
      <ul v-if="passkeys.length" class="flex flex-col gap-2">
        <li v-for="p in passkeys" :key="p.id" class="flex flex-wrap items-center justify-between gap-2 rounded-sm p-3 ring ring-default">
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-fingerprint" class="size-4 text-muted" aria-hidden="true" />
            <span class="text-highlighted">{{ p.name }}</span>
            <span class="text-caption text-muted">· {{ p.last_used_at ? t('account.security.lastUsed', { date: dateTime(p.last_used_at) }) : t('account.security.neverUsed') }}</span>
          </span>
          <UButton :label="t('common.delete')" color="error" variant="ghost" size="sm" @click="removePasskey(p)" />
        </li>
      </ul>
      <UButton v-if="canPasskey" :label="t('account.security.addPasskey')" icon="i-lucide-plus" color="neutral" variant="outline" :loading="passkeyBusy" class="self-start" @click="addPasskey" />
      <p v-else class="text-small text-muted">{{ t('account.security.passkeysUnsupported') }}</p>
    </section>

    <template v-if="providers.google || providers.apple || account?.identities.length">
      <USeparator />
      <section class="flex flex-col gap-4" aria-labelledby="sec-providers">
        <h2 id="sec-providers" class="font-display text-h3 text-highlighted">{{ t('account.security.connected') }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="p in (['google', 'apple'] as Provider[]).filter(x => providers[x] || linked(x))" :key="p" class="flex flex-wrap items-center justify-between gap-2 rounded-sm p-3 ring ring-default">
            <span class="flex items-center gap-2">
              <UIcon :name="`i-simple-icons-${p}`" class="size-4" aria-hidden="true" />
              <span class="text-highlighted">{{ t(`account.security.provider.${p}`) }}</span>
              <span v-if="linked(p)" class="text-caption text-muted">· {{ linked(p)?.email ?? t('account.security.connectedShort') }}</span>
            </span>
            <UButton v-if="linked(p)" :label="t('account.security.unlink')" color="neutral" variant="ghost" size="sm" @click="unlink(p)" />
            <UButton v-else :label="t('account.security.link')" color="neutral" variant="outline" size="sm" @click="link(p)" />
          </li>
        </ul>
        <p class="text-caption text-muted">{{ t('account.security.emailAlwaysWorks') }}</p>
      </section>
    </template>

    <USeparator />

    <section class="flex flex-col gap-4" aria-labelledby="sec-sessions">
      <h2 id="sec-sessions" class="font-display text-h3 text-highlighted">{{ t('account.security.sessions') }}</h2>
      <ul class="flex flex-col gap-2">
        <li v-for="s in sessions" :key="s.id" class="flex flex-wrap items-center justify-between gap-2 rounded-sm p-3 ring ring-default">
          <div class="flex flex-col">
            <span class="text-highlighted">
              {{ device(s.user_agent) }}
              <UBadge v-if="s.current" :label="t('account.security.thisDevice')" color="success" variant="subtle" size="sm" class="ms-2" />
            </span>
            <span class="text-caption text-muted">
              {{ s.last_used_at ? t('account.security.lastActive', { date: dateTime(s.last_used_at) }) : dateTime(s.created_at) }}
              <template v-if="s.ip_address"> · <span dir="ltr">{{ s.ip_address }}</span></template>
              <template v-if="!s.persistent"> · {{ t('account.security.sharedSession') }}</template>
            </span>
          </div>
          <UButton v-if="!s.current" :label="t('account.security.signOutDevice')" color="neutral" variant="ghost" size="sm" @click="revoke(s)" />
        </li>
      </ul>
      <UButton :label="t('account.security.signOutEverywhere')" icon="i-lucide-log-out" color="error" variant="outline" class="self-start" @click="everywhereOpen = true" />
    </section>
    <MzConfirmDialog
      v-model:open="everywhereOpen"
      :title="t('account.security.signOutEverywhere')"
      :description="t('account.security.signOutEverywhereText')"
      :confirm-label="t('account.security.signOutEverywhere')"
      danger
      @confirm="signOutEverywhere"
    />
  </MzAccountShell>
</template>
