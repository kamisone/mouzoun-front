import { type TranslationOutcome, applyTranslations, summarizeErrors } from '~/utils/translate-generate'

/**
 * The "Générer" action of the back office (as in vitecamio): sends the source-language fields
 * (French, the default locale) and fills every other active locale with the result. One
 * instance per button, so each shows its own spinner and error.
 */
export function useTranslationGenerate() {
  const admin = useAdminApi()
  const { t } = useI18n()
  const toast = useToast()
  const generating = ref(false)
  const error = ref<string | null>(null)

  /**
   * `source`: field → text in the source locale; `target`: locale → fields object to fill
   * (e.g. `form.translations`); `html`: keys holding HTML.
   */
  async function generate(source: Record<string, string | null | undefined>, target: Record<string, Record<string, unknown>>, html: string[] = []) {
    const fields = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v ?? '']))
    if (!Object.values(fields).some(v => v.trim())) {
      error.value = t('admin.translate.needSource')
      return
    }
    generating.value = true
    error.value = null
    try {
      const outcome = await admin.translations.generate({ fields, html })
      const changed = applyTranslations(target, outcome)
      error.value = summarizeErrors(outcome.errors)
      if (!error.value) toast.add({ title: t('admin.translate.done', { count: changed }), color: 'success', icon: 'i-lucide-languages' })
    }
    catch (e) {
      const err = (e as { data?: { error?: { code?: string, message?: string } } }).data?.error
      error.value = err?.code === 'translation_disabled' ? t('admin.translate.disabled') : (err?.message ?? t('admin.translate.failed'))
    }
    finally {
      generating.value = false
    }
  }
  return { generate, generating, error }
}

export type { TranslationOutcome }
