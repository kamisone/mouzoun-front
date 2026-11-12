<script setup lang="ts">
/** The link of the "your data is ready" email: downloads the JSON file (same account only). */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const route = useRoute()
const api = useAccountApi()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const error = ref<string | null>(token ? null : t('account.errors.link_expired'))
const busy = ref(false)

async function download() {
  busy.value = true
  error.value = null
  try {
    const res = await fetch(api.privacy.exportUrl(token), { credentials: 'include' })
    if (!res.ok) throw new Error(String(res.status))
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = 'mouzoun-my-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  catch {
    error.value = t('account.errors.link_expired')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <MzAccountShell :title="t('account.privacy.exportTitle')">
    <UAlert v-if="error" :title="error" color="error" variant="subtle" role="alert" />
    <p v-else class="max-w-prose text-muted">{{ t('account.privacy.exportReady') }}</p>
    <UButton v-if="token" :label="t('account.privacy.download')" icon="i-lucide-download" :loading="busy" class="self-start" @click="download" />
  </MzAccountShell>
</template>
