import type { Account, SignInResult } from '~/utils/account-types'

const HINT = 'mz-signed-in'
const SAVED = 'mz-saved'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  }
  catch {
    return null
  }
}

/**
 * The signed-in guest (browser only). The session is a pair of HttpOnly cookies; a local hint
 * avoids asking the API on every page for visitors who never signed in.
 */
export function useAccount() {
  const account = useState<Account | null>('account', () => null)
  const ready = useState<boolean>('account-ready', () => false)
  const api = useAccountApi()
  const trip = useTrip()

  async function load(force = false) {
    if (import.meta.server) return account.value
    if (!force && !storage()?.getItem(HINT)) {
      ready.value = true
      return null
    }
    try {
      account.value = await api.me()
      storage()?.setItem(HINT, '1')
    }
    catch {
      account.value = null
      storage()?.removeItem(HINT)
    }
    ready.value = true
    return account.value
  }

  /** After any successful sign-in: keep the account, merge this device's hearts and basket. */
  async function signedIn(result: SignInResult) {
    account.value = result.account
    ready.value = true
    storage()?.setItem(HINT, '1')
    await useSaved(account).mergeLocal()
    await trip.refresh().catch(() => {})
  }

  async function signOut(everywhere = false) {
    try {
      if (everywhere) await api.auth.logoutAll()
      else await api.auth.logout()
    }
    finally {
      account.value = null
      storage()?.removeItem(HINT)
      useSaved(account).reset()
      await trip.refresh().catch(() => {})
    }
  }

  const displayName = computed(() => {
    const a = account.value
    if (!a) return ''
    return a.first_name || a.email.split('@')[0] || ''
  })

  return { account, ready, load, signedIn, signOut, displayName }
}

/**
 * Hearts. Before signing in they live on this device; signing in adds them to the account's
 * "Saved" list. Product ids only: no personal data in local storage.
 */
export function useSaved(accountRef?: Ref<Account | null>) {
  const ids = useState<string[]>('saved-ids', () => [])
  const loaded = useState<boolean>('saved-loaded', () => false)
  const account = accountRef ?? useState<Account | null>('account', () => null)
  const api = useAccountApi()

  function local(): string[] {
    try {
      return JSON.parse(storage()?.getItem(SAVED) ?? '[]') as string[]
    }
    catch {
      return []
    }
  }
  function writeLocal(list: string[]) {
    try {
      storage()?.setItem(SAVED, JSON.stringify(list))
    }
    catch { /* not kept */ }
  }

  async function load() {
    if (import.meta.server || loaded.value) return
    loaded.value = true
    if (account.value) ids.value = (await api.saved.ids().catch(() => ({ product_ids: [] }))).product_ids
    else ids.value = local()
  }

  async function mergeLocal() {
    const pending = local()
    const res = pending.length
      ? await api.saved.merge(pending).catch(() => null)
      : await api.saved.ids().catch(() => null)
    if (res) {
      ids.value = res.product_ids
      loaded.value = true
      if (pending.length) writeLocal([])
    }
  }

  function reset() {
    ids.value = local()
  }

  const has = (id: string) => ids.value.includes(id)

  async function toggle(id: string) {
    const was = has(id)
    ids.value = was ? ids.value.filter(x => x !== id) : [...ids.value, id]
    try {
      if (account.value) {
        if (was) await api.saved.remove(id)
        else await api.saved.add(id)
      }
      else writeLocal(ids.value)
    }
    catch (e) {
      ids.value = was ? [...ids.value, id] : ids.value.filter(x => x !== id)
      throw e
    }
    return !was
  }

  return { ids, load, has, toggle, mergeLocal, reset }
}

/**
 * "Confirm it's you" before sensitive actions: runs `action`; when the API answers
 * `reauthentication_required`, opens the dialog (code, password or passkey) and retries once.
 */
export function useReauth() {
  const open = useState<boolean>('reauth-open', () => false)
  const resolver = useState<((ok: boolean) => void) | null>('reauth-resolver', () => null)

  function ask(): Promise<boolean> {
    open.value = true
    return new Promise((resolve) => {
      resolver.value = resolve
    })
  }

  function done(ok: boolean) {
    open.value = false
    resolver.value?.(ok)
    resolver.value = null
  }

  async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
      return await action()
    }
    catch (e) {
      if (apiErrorCode(e) !== 'reauthentication_required') throw e
      if (!(await ask())) return undefined
      return await action()
    }
  }

  return { open, ask, done, guard }
}
