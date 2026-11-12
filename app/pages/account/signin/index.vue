<script setup lang="ts">
/** "Sign in or create an account" as a page (links from emails, the header, protected pages). */
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
useHead({ title: () => `${t('account.signin.title')} · ${t('common.siteName')}`, meta: [{ name: 'robots', content: 'noindex' }] })

const returnTo = computed(() => {
  const r = route.query.return_to
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : undefined
})

const { account, load } = useAccount()
onMounted(async () => {
  if (!account.value) await load()
  if (account.value) await navigateTo(returnTo.value ?? localePath('/account'), { replace: true })
})

async function done() {
  await navigateTo(returnTo.value ?? localePath('/account'))
}
</script>

<template>
  <MzSignInPanel :return-to="returnTo" @signed-in="done" />
</template>
