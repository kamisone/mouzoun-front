import type { SessionResponse, User } from '~/utils/types'

export interface MfaChallenge {
  mfa_token: string
  mfa_required: true
}

/**
 * Back-office session. The session itself is an HttpOnly cookie set by the API: JavaScript never
 * sees the token, it only keeps the current user.
 */
export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const config = useRuntimeConfig()
  const api = $fetch.create({ baseURL: config.public.apiBase, credentials: 'include' })

  /**
   * Password step. Staff who turned two-factor sign-in on (back-office settings) then get a
   * challenge: a code from their authenticator app, sent with `verifyMfa`.
   */
  async function login(email: string, password: string): Promise<MfaChallenge | null> {
    const res = await api<SessionResponse | MfaChallenge>('/v1/auth/login', { method: 'POST', body: { email, password } })
    if ('mfa_token' in res) return res
    if (!res.user.is_staff) {
      await logout()
      throw new Error('forbidden')
    }
    user.value = res.user
    return null
  }

  async function verifyMfa(token: string, code: string) {
    const res = await api<SessionResponse>('/v1/auth/mfa', { method: 'POST', body: { mfa_token: token, code } })
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

  return { user, login, verifyMfa, fetchMe, logout }
}
