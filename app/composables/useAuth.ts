import type { LoginResponse, User } from '~/utils/types'

const TOKEN_KEY = 'mouzoun_admin_token'

/** Admin authentication state (admin pages are client-rendered). */
export function useAuth() {
  const token = useState<string | null>('auth-token', () =>
    import.meta.client ? localStorage.getItem(TOKEN_KEY) : null,
  )
  const user = useState<User | null>('auth-user', () => null)

  async function login(email: string, password: string) {
    const res = await useAdminApi()<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    if (res.user.role === 'customer') throw new Error('forbidden')
    token.value = res.access_token
    localStorage.setItem(TOKEN_KEY, res.access_token)
    user.value = res.user
  }

  async function fetchMe() {
    user.value = await useAdminApi()<User>('/v1/auth/me')
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, user, login, fetchMe, logout }
}

/** $fetch instance for admin calls: adds the Bearer token, logs out on 401. */
export function useAdminApi() {
  const token = useState<string | null>('auth-token')
  return $fetch.create({
    baseURL: useRuntimeConfig().public.apiBase,
    onRequest({ options }) {
      if (token.value) options.headers.set('Authorization', `Bearer ${token.value}`)
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        token.value = null
        localStorage.removeItem(TOKEN_KEY)
        await navigateTo('/admin/login')
      }
    },
  })
}
