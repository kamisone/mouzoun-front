<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'

definePageMeta({ layout: 'auth', middleware: 'admin-auth', i18n: false })

const { t } = useI18n()
const { login } = useAuth()
const route = useRoute()
const v = useValidation()

const schema = computed(() => z.object({ email: v.email(), password: v.required() }))
type Schema = z.output<typeof schema.value>
const state = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)

useHead({ title: () => t('auth.title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

async function submit(event: FormSubmitEvent<Schema>) {
  error.value = ''
  loading.value = true
  try {
    await login(event.data.email, event.data.password)
    const redirect = typeof route.query.redirect === 'string' && /^\/(?:admin|_styleguide)(?:[/?]|$)/.test(route.query.redirect) ? route.query.redirect : '/admin'
    await navigateTo(redirect)
  }
  catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = (e as Error).message === 'forbidden'
      ? t('auth.forbidden')
      : status === 429
        ? t('auth.tooMany')
        : status === 401 || status === 400 || status === 422
          ? t('auth.invalid')
          : t('auth.error')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-2xl font-semibold">{{ t('auth.title') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('auth.subtitle') }}</p>
    </div>
    <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="submit">
      <MzFormField name="email" :label="t('auth.email')" required>
        <UInput v-model="state.email" type="email" autocomplete="username" class="w-full" />
      </MzFormField>
      <MzFormField name="password" :label="t('auth.password')" required>
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </MzFormField>
      <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
      <UButton type="submit" :label="t('auth.submit')" :loading="loading" block size="lg" />
    </UForm>
  </div>
</template>
