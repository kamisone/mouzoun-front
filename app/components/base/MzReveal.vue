<script setup lang="ts">
/**
 * Scroll reveal: fade + 16 px rise, 600 ms, editorial ease, staggered by `index` × 60 ms.
 * Server-rendered visible; on the client, only elements still below the fold are hidden and then
 * revealed (no flash, no hidden content without JavaScript). Off with prefers-reduced-motion.
 */
const props = withDefaults(defineProps<{ index?: number, as?: string }>(), { index: 0, as: 'div' })

const el = useTemplateRef<HTMLElement>('el')
const reducedMotion = usePreferredReducedMotion()
const state = ref<'idle' | 'hidden' | 'shown'>('idle')

onMounted(() => {
  if (!el.value || reducedMotion.value === 'reduce') return
  if (el.value.getBoundingClientRect().top < window.innerHeight * 0.9) return
  state.value = 'hidden'
  const { stop } = useIntersectionObserver(el, ([entry]) => {
    if (entry?.isIntersecting) {
      state.value = 'shown'
      stop()
    }
  }, { rootMargin: '0px 0px -10% 0px' })
})
</script>

<template>
  <component
    :is="props.as"
    ref="el"
    class="transition-[opacity,translate] duration-(--duration-reveal) ease-(--ease-editorial)"
    :class="state === 'hidden' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'"
    :style="state === 'shown' ? { transitionDelay: `${props.index * 60}ms` } : undefined"
  >
    <slot />
  </component>
</template>
