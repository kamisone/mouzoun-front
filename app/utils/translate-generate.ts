/** Response of `POST /v1/admin/translations/generate`: values per target locale, reasons per failed locale. */
export interface TranslationOutcome {
  result: Record<string, Record<string, string>>
  errors: Record<string, string>
}

/**
 * Copies generated values into `target[locale][field]`. Empty values (a failed language, an
 * empty source) never overwrite what the admin already wrote. Returns how many fields changed.
 */
export function applyTranslations(target: Record<string, Record<string, unknown>>, outcome: TranslationOutcome): number {
  let changed = 0
  for (const [locale, fields] of Object.entries(outcome.result)) {
    if (!target[locale]) continue
    for (const [field, value] of Object.entries(fields)) {
      if (value && value.trim() && target[locale][field] !== value) {
        target[locale][field] = value
        changed++
      }
    }
  }
  return changed
}

/** One line for the failed languages: "AR: rate limited…" (null when all succeeded). */
export function summarizeErrors(errors: Record<string, string>): string | null {
  const entries = Object.entries(errors).filter(([, m]) => !!m)
  if (!entries.length) return null
  const langs = entries.map(([l]) => l.toUpperCase()).join(', ')
  const messages = [...new Set(entries.map(([, m]) => m))]
  return messages.length === 1 ? `${langs}: ${messages[0]}` : langs
}
