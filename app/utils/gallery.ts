/** Keeps Tab and Shift+Tab inside a dialog (`event` is the keydown of a Tab). */
export function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, video[controls], [tabindex]:not([tabindex="-1"])',
  )].filter(el => el.offsetParent !== null || el === document.activeElement)
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

/** Web Share API when the device has it, else the link is copied. */
export async function shareLink(data: { title: string, text?: string, url: string }): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(data)
      return 'shared'
    }
    await navigator.clipboard.writeText(data.url)
    return 'copied'
  }
  catch {
    return 'failed'
  }
}
