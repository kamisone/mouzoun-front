import { type ConsentChoice, readConsent, writeConsent } from '~/utils/consent'

/** Cookie consent state shared by the banner, the footer link and the analytics. */
export function useConsent() {
  const choice = useState<ConsentChoice | null>('consent-choice', () => null)
  const open = useState('consent-open', () => false)
  const ready = useState('consent-ready', () => false)

  function init() {
    if (import.meta.server || ready.value) return
    choice.value = readConsent()
    open.value = choice.value === null
    ready.value = true
  }
  function decide(c: ConsentChoice) {
    writeConsent(c)
    choice.value = c
    open.value = false
    if (c === 'denied') {
      // Withdrawal: drop what the measurement may have queued.
      const w = window as unknown as { dataLayer?: unknown[] }
      w.dataLayer = []
    }
  }
  return { choice, open, init, decide, reopen: () => { open.value = true } }
}
