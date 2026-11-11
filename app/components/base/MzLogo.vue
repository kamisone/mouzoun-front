<script setup lang="ts">
/** Mouzoun wordmark: the name set in the display serif, nothing else. Links home unless `to` is false. */
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  to?: string | false
  /** Monogram only ("M"), e.g. collapsed admin sidebar; keeps an accessible name. */
  iconOnly?: boolean
}>(), { size: 'md', to: undefined, iconOnly: false })

const { t } = useI18n()
const localePath = useLocalePath()
const target = computed(() => (props.to === false ? undefined : props.to ?? localePath('/')))
const sizes = { sm: 'text-h3', md: 'text-h3 md:text-h2', lg: 'text-h1' }
</script>

<template>
  <NuxtLink
    v-if="target"
    :to="target"
    class="inline-flex min-h-11 items-center font-display leading-none tracking-tight text-highlighted"
    :class="sizes[props.size]"
    :aria-label="props.iconOnly ? t('common.siteName') : undefined"
  >
    <span v-if="props.iconOnly" aria-hidden="true">M</span>
    <span v-else>{{ t('common.siteName') }}</span>
  </NuxtLink>
  <span v-else class="inline-flex min-h-11 items-center font-display leading-none tracking-tight text-highlighted" :class="sizes[props.size]">
    {{ props.iconOnly ? 'M' : t('common.siteName') }}
  </span>
</template>
