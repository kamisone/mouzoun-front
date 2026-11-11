import type { SessionResponse, User } from '~/utils/types'

/**
 * Back-office session. The session itself is an HttpOnly cookie set by the API: JavaScript never
 * sees the token, it only keeps the current user.
 */
export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const config = useRuntimeConfig()
  const api = $fetch.create({ baseURL: config.public.apiBase, credentials: 'include' })

  async function login(email: string, password: string) {
    const res = await api<SessionResponse>('/v1/auth/login', { method: 'POST', body: { email, password } })
    if (!res.user.is_staff) {
      await logout()
      throw new Error('forbidden')
    }
    user.value = res.user
  }

  /** Loads the current user from the session cookie; throws (401) when there is no session. */
  async function fetchMe() {
    user.value = await api<User>('/v1/auth/me')
  }

  async function logout() {
    try {
      await api('/v1/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
    }
  }

  return { user, login, fetchMe, logout }
}
