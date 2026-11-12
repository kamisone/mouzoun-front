<script setup lang="ts">
import { countries } from '~/utils/contact'

/**
 * Personal information. The same details fill the checkout and every booking's customer record.
 * The email is changed under "Login & security" (it needs a code sent to the new address).
 */
definePageMeta({ middleware: 'account' })
const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const api = useAccountApi()
const toast = useToast()
const { account } = useAccount()

const form = reactive({
  first_name: '',
  last_name: '',
  phone: '',
  country_code: '',
  preferred_locale: '',
  display_currency: '',
  date_of_birth: '',
  marketing_consent: false,
})
watchEffect(() => {
  const a = account.value
  if (!a) return
  Object.assign(form, {
    first_name: a.first_name,
    last_name: a.last_name ?? '',
    phone: a.phone ?? '',
    country_code: a.country_code ?? '',
    preferred_locale: a.preferred_locale ?? locale.value,
    display_currency: a.display_currency ?? 'EUR',
    date_of_birth: a.date_of_birth ?? '',
    marketing_consent: a.marketing_consent,
  })
})
const welcome = computed(() => route.query.welcome === '1')
const countryItems = computed(() => countries(locale.value))
const languages = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]
const currencies = ['EUR', 'MAD', 'USD'].map(c => ({ value: c, label: c }))
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)

async function save() {
  errors.first_name = form.first_name.trim() ? undefined : t('validation.required')
  errors.last_name = form.last_name.trim() ? undefined : t('validation.required')
  errors.phone = form.phone && form.phone.replace(/\D/g, '').length < 6 ? t('booking.checkout.errors.phone') : undefined
  if (Object.values(errors).some(Boolean)) return
  saving.value = true
  try {
    account.value = await api.update({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || null,
      country_code: form.country_code || null,
      preferred_locale: form.preferred_locale,
      display_currency: form.display_currency,
      date_of_birth: form.date_of_birth || null,
      marketing_consent: form.marketing_consent,
    })
    toast.add({ title: t('account.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    const field = apiErrorDetails<{ field?: string }>(e)?.field
    if (field) errors[field] = t('account.errors.invalid_field')
    else toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <MzAccountShell :title="t('account.nav.profile')" :description="t('account.profile.intro')">
    <UAlert v-if="welcome" :title="t('account.profile.welcome')" :description="t('account.profile.welcomeText')" color="success" variant="subtle" icon="i-lucide-party-popper" />
    <form class="grid max-w-2xl gap-6 sm:grid-cols-2" novalidate @submit.prevent="save">
      <UFormField :label="t('account.profile.firstName')" :error="errors.first_name" required>
        <UInput v-model="form.first_name" autocomplete="given-name" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.lastName')" :error="errors.last_name" required>
        <UInput v-model="form.last_name" autocomplete="family-name" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.email')" class="sm:col-span-2" :help="t('account.profile.emailHelp')">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-highlighted" dir="ltr">{{ account?.email }}</span>
          <UButton :to="localePath('/account/security#email')" :label="t('account.profile.changeEmail')" color="neutral" variant="link" size="sm" />
        </div>
      </UFormField>
      <UFormField :label="t('account.profile.phone')" :error="errors.phone" :hint="t('common.optional')">
        <UInput v-model="form.phone" type="tel" autocomplete="tel" dir="ltr" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.country')" :hint="t('common.optional')">
        <USelectMenu v-model="form.country_code" :items="countryItems" value-key="value" autocomplete="country" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.birthDate')" :hint="t('common.optional')">
        <UInput v-model="form.date_of_birth" type="date" autocomplete="bday" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.language')">
        <USelect v-model="form.preferred_locale" :items="languages" class="w-full" />
      </UFormField>
      <UFormField :label="t('account.profile.currency')" :help="t('account.profile.currencyHelp')">
        <USelect v-model="form.display_currency" :items="currencies" class="w-full" />
      </UFormField>
      <UCheckbox v-model="form.marketing_consent" :label="t('account.profile.offersConsent')" class="sm:col-span-2" />
      <UButton type="submit" :label="t('common.save')" :loading="saving" class="justify-self-start" />
    </form>
  </MzAccountShell>
</template>
