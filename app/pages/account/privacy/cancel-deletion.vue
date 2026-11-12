<script setup lang="ts">
/** "Keep my account" link of the deletion email: works without signing in. */
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const api = useAccountApi()
const state = ref<'idle' | 'done' | 'error'>('idle')
const busy = ref(false)
useHead({ title: () => t('account.privacy.keep'), meta: [{ name: 'robots', content: 'noindex' }] })
async function keep() {
  busy.value = true
  try {
    await api.privacy.cancelDeletionByLink(String(route.query.token ?? ''))
    state.value = 'done'
  }
  catch {
    state.value = 'error'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="font-display text-h2 text-highlighted">{{ t('account.privacy.keepTitle') }}</h1>
    <UAlert v-if="state === 'done'" :title="t('account.privacy.kept')" color="success" variant="subtle" role="status" />
    <UAlert v-else-if="state === 'error'" :title="t('account.errors.link_expired')" color="error" variant="subtle" role="alert" />
    <UButton v-if="state === 'idle'" :label="t('account.privacy.keep')" :loading="busy" size="lg" block @click="keep" />
    <UButton :to="localePath('/account')" :label="t('account.nav.overview')" color="neutral" variant="link" class="self-start" />
  </div>
</template>
