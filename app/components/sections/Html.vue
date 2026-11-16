<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Raw HTML from a super admin, sanitised server side (no scripts, frames, handlers). */
const props = defineProps<{ section: RenderedSection, index: number }>()
</script>

<template>
  <MzSectionContainer :section="props.section">
    <!-- eslint-disable-next-line vue/no-v-html -- sanitised server side (ammonia allowlist, scripts refused) -->
    <div v-html="props.section.content.html" />
  </MzSectionContainer>
</template>
