<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Key figures (number + suffix + label). Counts up once when visible; the final value is rendered on the server. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { text } = useSectionContext(() => props.section)
const { locale } = useI18n()
const s = computed(() => props.section.settings)
const root = useTemplateRef<HTMLElement>('root')
const reducedMotion = usePreferredReducedMotion()
const progress = ref(1)
const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4', 5: 'grid-cols-2 lg:grid-cols-5', 6: 'grid-cols-2 lg:grid-cols-6' } as const

onMounted(() => {
  if (!s.value.animate || reducedMotion.value === 'reduce' || !root.value) return
  if (root.value.getBoundingClientRect().top < window.innerHeight) return
  progress.value = 0
  const { stop } = useIntersectionObserver(root, ([entry]) => {
    if (!entry?.isIntersecting) return
    stop()
    const start = performance.now()
    const tick = (now: number) => {
      progress.value = Math.min(1, (now - start) / 1200)
      if (progress.value < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
})
const format = (n: number) => new Intl.NumberFormat(locale.value).format(Math.round(n * progress.value))
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <dl ref="root" class="grid gap-8 border-t border-default pt-12" :class="cols[Number(s.columns ?? 4) as keyof typeof cols] ?? cols[4]">
      <div v-for="item in props.section.items" :key="item.id" class="flex flex-col-reverse gap-2">
        <dt class="text-small text-muted">{{ text(item.content.label) }}</dt>
        <dd class="font-display text-display-lg lining-nums" :aria-label="`${item.settings.number}${item.settings.suffix ?? ''}`">
          <span aria-hidden="true">{{ format(Number(item.settings.number ?? 0)) }}{{ item.settings.suffix ? ` ${item.settings.suffix}` : '' }}</span>
        </dd>
      </div>
    </dl>
  </MzSectionContainer>
</template>
