<script setup lang="ts">
/**
 * The link of the sign-in email. It needs one click (mail scanners open links on their own and
 * would spend it) and asks whether the device is shared.
 */
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const api = useAccountApi()
const { signedIn } = useAccount()
useHead({ title: () => `${t('account.signin.title')} · ${t('common.siteName')}`, meta: [{ name: 'robots', content: 'noindex' }] })

const email = typeof route.query.e === 'string' ? route.query.e : ''
const token = typeof route.query.t === 'string' ? route.query.t : ''
const returnTo = typeof route.query.r === 'string' && route.query.r.startsWith('/') && !route.query.r.startsWith('//') ? route.query.r : null
// Keep the token out of the address bar.
onMounted(() => router.replace({ query: {} }))

const sharedDevice = ref(false)
const busy = ref(false)
const error = ref<string | null>(email && token ? null : t('account.errors.link_expired'))
const needsProfile = ref(false)

async function go() {
  busy.value = true
  error.value = null
  try {
    const res = await api.auth.link(email, token, sharedDevice.value)
    await signedIn(res)
    await navigateTo(res.needs_profile ? localePath('/account/profile?welcome=1') : returnTo ?? localePath('/account'))
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
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-h2 text-highlighted">{{ t('account.link.title') }}</h1>
    <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
    <template v-if="email && token && !needsProfile">
      <p class="text-small text-muted">{{ t('account.link.intro', { email }) }}</p>
      <UCheckbox v-model="sharedDevice" :label="t('account.signin.sharedDevice')" :description="t('account.signin.sharedDeviceHint')" />
      <UButton :label="t('account.link.continue')" :loading="busy" size="lg" block data-testid="link-continue" @click="go" />
    </template>
    <UButton :to="localePath('/account/signin')" :label="t('account.link.newCode')" color="neutral" variant="link" class="self-start" />
  </div>
</template>
