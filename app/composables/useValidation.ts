import { z } from 'zod'

/**
 * Zod schema builders with translated messages, for UForm. Build schemas inside a computed so
 * messages follow a language change:
 *
 * const v = useValidation()
 * const schema = computed(() => z.object({ email: v.email(), password: v.required() }))
 */
export function useValidation() {
  const { t } = useI18n()
  const required = () => z.string().trim().min(1, { error: t('validation.required') })
  return {
    required,
    email: () => required().pipe(z.email({ error: t('validation.email') })),
    text: (opts: { min?: number, max?: number } = {}) => {
      let s = z.string().trim()
      if (opts.min) s = s.min(opts.min, { error: t('validation.minLength', { min: opts.min }) })
      if (opts.max) s = s.max(opts.max, { error: t('validation.maxLength', { max: opts.max }) })
      return s
    },
    /** Integer cents (MzMoneyInput). */
    cents: () => z.number({ error: t('validation.money') }).int({ error: t('validation.money') }).nonnegative({ error: t('validation.positive') }),
    /** `{ fr, en, ar }` with the listed languages required (MzTranslatableInput). */
    translations: (requiredLocales: string[] = ['fr']) =>
      z.record(z.string(), z.string().optional()).superRefine((value, ctx) => {
        for (const code of requiredLocales) {
          if (!value[code]?.trim()) ctx.addIssue({ code: 'custom', message: `${t('validation.required')} (${code.toUpperCase()})` })
        }
      }),
  }
}
