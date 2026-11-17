<script setup lang="ts">
/** `catalog_only`: buying is off; visitors leave their email to hear about the opening. */
const { t } = useI18n()
const api = useShopApi()
const email = ref('')
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle')
const errorId = useId()

async function submit() {
  if (!email.value.includes('@')) {
    state.value = 'error'
    return
  }
  state.value = 'sending'
  try {
    await api.notifyOpening(email.value)
    state.value = 'done'
  }
  catch {
    state.value = 'error'
  }
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-md border border-default bg-elevated p-6" data-testid="shop-coming-soon" aria-labelledby="coming-soon-title">
    <h2 id="coming-soon-title" class="font-display text-h3 text-highlighted">{{ t('shop.comingSoon.title') }}</h2>
    <p class="text-body text-muted">{{ t('shop.comingSoon.text') }}</p>
    <p v-if="state === 'done'" class="text-body text-success" role="status">{{ t('shop.comingSoon.done') }}</p>
    <form v-else class="flex flex-wrap gap-2" novalidate @submit.prevent="submit">
      <UInput
        v-model="email"
        type="email"
        autocomplete="email"
        :placeholder="t('shop.comingSoon.placeholder')"
        :aria-label="t('shop.comingSoon.placeholder')"
        :aria-invalid="state === 'error'"
        :aria-describedby="state === 'error' ? errorId : undefined"
        class="min-w-60 flex-1"
      />
      <UButton type="submit" :label="t('shop.comingSoon.cta')" :loading="state === 'sending'" />
      <p v-if="state === 'error'" :id="errorId" class="w-full text-small text-error">{{ t('shop.checkout.invalid') }}</p>
    </form>
  </section>
</template>
