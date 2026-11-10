<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'admin-auth', i18n: false })

const { login } = useAuth()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/admin')
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    error.value =
      status === 429
        ? 'Trop de tentatives, réessayez dans une minute'
        : status === 401 || status === 400 || status === 422 || (e as Error).message === 'forbidden'
          ? 'Identifiants invalides'
          : 'Service indisponible, réessayez plus tard'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-sand-50 p-4">
    <form class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow" @submit.prevent="submit">
      <h1 class="text-2xl font-bold">Mouzoun Admin</h1>
      <input v-model="email" type="email" required placeholder="Email" class="input" autocomplete="username" />
      <input
        v-model="password"
        type="password"
        required
        placeholder="Mot de passe"
        class="input"
        autocomplete="current-password"
      />
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button class="btn w-full justify-center" :disabled="loading">Se connecter</button>
    </form>
  </div>
</template>
