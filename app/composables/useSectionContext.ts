import type { InjectionKey } from 'vue'
import type { MediaView, RenderedSection } from '~/utils/page-types'
import { interpolate, mediaOf } from '~/utils/page-builder'

export interface PageContext {
  variables: Record<string, string | null>
  preview: boolean
}

export const PAGE_CONTEXT: InjectionKey<PageContext> = Symbol('page-context')

/**
 * Helpers of a section component: its texts with `{opening_date}` filled in, its media, and its
 * heading level (h2 unless the editor chose h3).
 */
export function useSectionContext(section: () => RenderedSection) {
  const ctx = inject(PAGE_CONTEXT, { variables: {}, preview: false })
  const { locale } = useI18n()
  const text = (value: unknown) => interpolate(typeof value === 'string' ? value : '', ctx.variables, locale.value)
  const media = (id: unknown): MediaView | undefined => mediaOf(section().data, id)
  const level = computed(() => (section().settings.title_level === 'h3' ? 3 : 2) as 2 | 3)
  return { text, media, level, preview: ctx.preview }
}
