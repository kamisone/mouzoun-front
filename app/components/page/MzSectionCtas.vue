<script setup lang="ts">
import type { CtaSettings, RenderedSection } from '~/utils/page-types'

/**
 * Up to two buttons of a section (settings `cta_primary` / `cta_secondary`, labels in content).
 * A button whose target is not published (href null) or has no label is not shown.
 */
const props = withDefaults(defineProps<{ section: RenderedSection, size?: 'md' | 'lg', center?: boolean }>(), { size: 'lg', center: false })
const { text } = useSectionContext(() => props.section)

const variants = { primary: { color: 'primary', variant: 'solid' }, secondary: { color: 'neutral', variant: 'outline' }, ghost: { color: 'neutral', variant: 'ghost' }, link: { color: 'neutral', variant: 'link' } } as const

const ctas = computed(() =>
  (['primary', 'secondary'] as const)
    .map((slot) => {
      const cta = props.section.settings[`cta_${slot}`] as CtaSettings | undefined
      const label = text(props.section.content[`cta_${slot}_label`])
      const href = cta?.link?.href
      if (!cta || !href || !label) return null
      return { key: slot, label, href, newTab: !!cta.link.new_tab, external: !!cta.link.external, ...variants[cta.style ?? (slot === 'primary' ? 'primary' : 'secondary')] }
    })
    .filter(c => c !== null),
)
</script>

<template>
  <div v-if="ctas.length" class="flex flex-wrap items-center gap-4" :class="props.center && 'justify-center'">
    <UButton
      v-for="cta in ctas"
      :key="cta.key"
      :label="cta.label"
      :to="cta.href"
      :target="cta.newTab ? '_blank' : undefined"
      :external="cta.external || cta.href.startsWith('#')"
      :rel="cta.newTab ? 'noopener' : undefined"
      :color="cta.color"
      :variant="cta.variant"
      :size="props.size"
      :data-testid="`cta-${cta.key}`"
    />
  </div>
</template>
