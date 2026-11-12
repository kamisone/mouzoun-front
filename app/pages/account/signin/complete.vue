<script setup lang="ts">
/** Back from Google / Apple: the API already set the session cookies. */
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { load, account: accountRef } = useAccount()
const saved = useSaved(accountRef)
const trip = useTrip()
useHead({ title: () => t('account.signin.title'), meta: [{ name: 'robots', content: 'noindex' }] })

onMounted(async () => {
  const account = await load(true)
  if (!account) return navigateTo(localePath('/account/signin?error=oauth_failed'), { replace: true })
  await saved.mergeLocal()
  await trip.refresh().catch(() => {})
  const r = typeof route.query.return_to === 'string' && route.query.return_to.startsWith('/') && !route.query.return_to.startsWith('//') ? route.query.return_to : null
  await navigateTo(route.query.new === 'true' ? localePath('/account/profile?welcome=1') : r ?? localePath('/account'), { replace: true })
})
</script>

<template>
  <div class="flex items-center gap-3 text-muted" role="status">
    <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" aria-hidden="true" />
    {{ t('account.signin.completing') }}
  </div>
</template>
