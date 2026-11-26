<script setup lang="ts">
/**
 * Cookie banner (CNIL): shown until the visitor chooses; "Refuse" is a button exactly like
 * "Accept"; closing it without choosing is not consent. The choice lasts 6 months and can be
 * changed from the footer ("Cookies").
 *
 * Not a dialog: it blocks nothing (no overlay, no focus trap, the page stays usable), so it is a
 * region named by its title. It comes right after the skip link in the page (layouts/default.vue)
 * so the keyboard reaches it early; focus is never moved into it. It sits above a fixed bottom
 * action bar (`--mz-bottom-bar`, set by the booking widget on phones) instead of covering it.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const { open, init, decide } = useConsent()
const { data: config } = useShopConfig()
const policy = computed(() => config.value?.legal_pages?.cookies ? localePath(`/${config.value.legal_pages.cookies}`) : null)
onMounted(init)
</script>

<template>
  <section
    v-if="open"
    aria-labelledby="cookie-title"
    aria-describedby="cookie-text"
    class="fixed inset-x-4 bottom-[calc(1rem+var(--mz-bottom-bar,0px))] z-(--z-toast) mx-auto flex max-w-2xl flex-col gap-4 rounded-md border border-default bg-elevated p-6 shadow-lifted"
    data-testid="cookie-banner"
  >
    <h2 id="cookie-title" class="font-display text-h4 text-highlighted">{{ t('consent.title') }}</h2>
    <p id="cookie-text" class="text-small text-default">
      {{ t('consent.text') }}
      <NuxtLink v-if="policy" :to="policy" class="underline">{{ t('consent.policy') }}</NuxtLink>
    </p>
    <div class="grid gap-3 sm:grid-cols-2">
      <UButton :label="t('consent.reject')" color="neutral" variant="solid" size="lg" block data-testid="cookie-reject" @click="decide('denied')" />
      <UButton :label="t('consent.accept')" color="neutral" variant="solid" size="lg" block data-testid="cookie-accept" @click="decide('granted')" />
    </div>
  </section>
</template>
