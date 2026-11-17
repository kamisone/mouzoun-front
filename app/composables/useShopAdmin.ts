/** Helpers shared by the shop back-office screens. */
export function useShopAdmin() {
  const { user } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const can = (permission: string) => user.value?.permissions.includes(permission) ?? false
  /** Runs an admin action: toast on success, the API's message on failure. Returns the result. */
  async function act<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    try {
      const out = await fn()
      if (success) toast.add({ title: success, color: 'success' })
      return out
    }
    catch (e) {
      const err = (e as { data?: { error?: { code?: string, message?: string } } }).data?.error
      const key = err?.code ? `admin.shop.errors.${err.code}` : ''
      const translated = key ? t(key) : ''
      toast.add({ title: translated && translated !== key ? translated : (err?.message ?? t('shop.errors.generic')), color: 'error' })
      return undefined
    }
  }
  const statusColor = (s: string) =>
    ['cancelled', 'refunded', 'voided', 'failed', 'rejected', 'high'].includes(s)
      ? 'error'
      : ['completed', 'paid', 'fulfilled', 'delivered', 'picked_up', 'closed', 'active', 'published'].includes(s)
          ? 'success'
          : ['pending', 'unpaid', 'requested', 'review', 'partially_paid', 'draft'].includes(s)
              ? 'warning'
              : 'neutral'
  return { can, act, statusColor }
}
