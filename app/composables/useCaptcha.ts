/**
 * Invisible Cloudflare Turnstile, only when the API asks for it. The API serves the site key with
 * its booking config, so the check is on for both sides or for neither. Resolves to a token, or
 * null (the API then decides).
 */
export function useCaptcha() {
  const { data: config } = useBookingConfig()

  async function token(containerId: string): Promise<string | null> {
    const siteKey = config.value?.captcha_site_key
    if (!config.value?.captcha || !siteKey) return null
    const w = window as unknown as { turnstile?: { render: (el: string, o: Record<string, unknown>) => string } }
    if (!w.turnstile) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('captcha'))
        document.head.appendChild(s)
      })
    }
    return new Promise((resolve) => {
      w.turnstile!.render(`#${containerId}`, { sitekey: siteKey, size: 'invisible', callback: (tk: string) => resolve(tk), 'error-callback': () => resolve(null) })
    })
  }

  return { token }
}
