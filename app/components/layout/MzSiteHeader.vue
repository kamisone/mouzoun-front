<script setup lang="ts">
/**
 * Public header. Over a hero (page meta `headerOverlay: true`) it starts transparent with ivory
 * text and becomes solid ivory with a hairline once the page scrolls (300 ms). Centred wordmark,
 * few navigation items, language, theme, "Book". Mobile: full-screen menu with large serif links.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { y } = useWindowScroll()
const open = ref(false)
watch(() => route.fullPath, () => { open.value = false })

const overlay = computed(() => route.meta.headerOverlay === true)
const scrolled = computed(() => y.value > 16)
const transparent = computed(() => overlay.value && !scrolled.value && !open.value)

const home = computed(() => localePath('/'))
const items = computed(() => [
  { label: t('nav.stay'), to: localePath('/stays') },
  { label: t('nav.activities'), to: localePath('/activities') },
  { label: t('nav.farm'), to: `${home.value}#farm` },
  { label: t('nav.practical'), to: `${home.value}#practical` },
])

// "Your trip" badge: loaded once per visit, kept in sync by the funnel pages.
const trip = useTrip()
const { account, ready, load: loadAccount } = useAccount()
onMounted(() => {
  if (!trip.cart.value) trip.refresh()
  if (!ready.value) loadAccount()
})
const accountTo = computed(() => localePath(account.value ? '/account' : '/account/signin'))
const accountLabel = computed(() => (account.value ? t('account.nav.myAccount') : t('account.signin.cta')))
</script>

<template>
  <header
    class="inset-x-0 top-0 z-(--z-sticky) transition-[background-color,border-color] duration-(--duration-header) ease-(--ease-editorial)"
    :class="[
      overlay ? 'fixed' : 'sticky',
      transparent ? 'dark border-b border-transparent bg-transparent' : 'border-b border-default bg-default',
    ]"
  >
    <MzContainer class="grid h-(--ui-header-height) grid-cols-[1fr_auto_1fr] items-center gap-4">
      <!-- Start: navigation (desktop) or menu button (mobile) -->
      <div class="flex items-center">
        <nav :aria-label="t('nav.mainNavigation')" class="hidden lg:block">
          <ul class="flex items-center gap-8">
            <li v-for="item in items" :key="item.to">
              <NuxtLink :to="item.to" class="text-small font-medium tracking-button text-highlighted transition-opacity hover:opacity-70">{{ item.label }}</NuxtLink>
            </li>
          </ul>
        </nav>
        <UButton
          :label="t('nav.menu')"
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="-ms-4 lg:hidden"
          :aria-expanded="open"
          aria-controls="mobile-menu"
          @click="open = true"
        />
      </div>

      <MzLogo />

      <!-- End: language, theme, book -->
      <div class="flex items-center justify-end gap-1">
        <MzLocaleSwitcher variant="text" class="hidden sm:inline-flex" />
        <MzThemeToggle class="hidden sm:inline-flex" />
        <UButton
          :to="accountTo"
          :icon="account ? 'i-lucide-circle-user-round' : 'i-lucide-user-round'"
          color="neutral"
          variant="ghost"
          :aria-label="accountLabel"
          data-testid="account-entry"
        />
        <UChip :show="trip.count.value > 0" :text="trip.count.value" size="3xl" color="primary" inset>
          <UButton
            :to="localePath('/trip')"
            icon="i-lucide-tent"
            color="neutral"
            variant="ghost"
            :aria-label="trip.count.value ? t('booking.trip.badge', { n: trip.count.value }, trip.count.value) : t('booking.trip.title')"
            data-testid="trip-badge"
          />
        </UChip>
        <UButton
          :to="localePath('/stays')"
          :label="t('common.book')"
          :color="transparent ? 'neutral' : 'primary'"
          :variant="transparent ? 'outline' : 'solid'"
          class="ms-4 hidden md:inline-flex"
        />
      </div>
    </MzContainer>

    <!-- Full-screen menu: no radius or ring, a slow fade instead of the default scale-in. -->
    <UModal
      v-model:open="open"
      fullscreen
      :title="t('nav.menu')"
      :ui="{
        content: 'bg-default rounded-none ring-0 shadow-none data-[state=open]:animate-[fade-in_300ms_var(--ease-editorial)] data-[state=closed]:animate-[fade-out_200ms_var(--ease-editorial)]',
        header: 'h-(--ui-header-height) px-6',
        body: 'flex flex-col justify-between px-6 pb-12',
      }"
    >
      <template #body>
        <nav id="mobile-menu" :aria-label="t('nav.mainNavigation')">
          <ul class="flex flex-col gap-4 pt-8">
            <li v-for="item in items" :key="item.to">
              <NuxtLink :to="item.to" class="font-display text-h1 text-highlighted" @click="open = false">{{ item.label }}</NuxtLink>
            </li>
          </ul>
        </nav>
        <div class="flex flex-col gap-6 pt-12">
          <div class="flex items-center gap-2">
            <MzLocaleSwitcher variant="text" />
            <MzThemeToggle />
          </div>
          <UButton :to="accountTo" :label="accountLabel" icon="i-lucide-user-round" color="neutral" variant="outline" size="lg" block @click="open = false" />
          <UButton :to="localePath('/stays')" :label="t('common.book')" size="lg" block @click="open = false" />
        </div>
      </template>
    </UModal>
  </header>
</template>
