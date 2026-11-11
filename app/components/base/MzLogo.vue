<script setup lang="ts">
/** Mouzoun wordmark (display font + tent mark). Links home unless `to` is false. */
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  to?: string | false
  /** Hide the wordmark text (the link keeps an accessible name). */
  iconOnly?: boolean
}>(), { size: 'md', to: undefined, iconOnly: false })

const { t } = useI18n()
const localePath = useLocalePath()
const target = computed(() => (props.to === false ? undefined : props.to ?? localePath('/')))
const sizes = {
  sm: { icon: 'size-5', text: 'text-lg' },
  md: { icon: 'size-7', text: 'text-2xl' },
  lg: { icon: 'size-9', text: 'text-3xl' },
}
</script>

<template>
  <NuxtLink
    v-if="target"
    :to="target"
    class="inline-flex min-h-11 items-center gap-2 rounded-md text-primary"
    :aria-label="props.iconOnly ? t('common.siteName') : undefined"
  >
    <UIcon name="i-lucide-tent-tree" :class="sizes[props.size].icon" aria-hidden="true" />
    <span v-if="!props.iconOnly" class="font-display font-semibold tracking-tight text-highlighted" :class="sizes[props.size].text">
      {{ t('common.siteName') }}
    </span>
  </NuxtLink>
  <span v-else class="inline-flex items-center gap-2 text-primary">
    <UIcon name="i-lucide-tent-tree" :class="sizes[props.size].icon" aria-hidden="true" />
    <span v-if="!props.iconOnly" class="font-display font-semibold tracking-tight text-highlighted" :class="sizes[props.size].text">
      {{ t('common.siteName') }}
    </span>
  </span>
</template>
