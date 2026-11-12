<script setup lang="ts">
import { encode } from 'uqr'

/**
 * A QR code drawn in the browser from its module matrix (no third-party service sees its
 * content, no HTML injection). Always dark on a light square, whatever the theme, so every
 * scanner reads it.
 */
const props = defineProps<{ value: string, label: string }>()
const BORDER = 2
// Scanners need maximum contrast in every theme. lint-tokens-ignore
const LIGHT = 'fill-white' // lint-tokens-ignore
const DARK = 'fill-black' // lint-tokens-ignore
const qr = computed(() => encode(props.value, { ecc: 'M', border: 0 }))
const size = computed(() => qr.value.size + BORDER * 2)
// One path: a 1×1 square per dark module.
const path = computed(() => {
  let d = ''
  qr.value.data.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) d += `M${x + BORDER} ${y + BORDER}h1v1h-1z`
  }))
  return d
})
</script>

<template>
  <svg
    role="img"
    :aria-label="props.label"
    :viewBox="`0 0 ${size} ${size}`"
    shape-rendering="crispEdges"
    class="aspect-square w-full max-w-72 rounded-sm"
  >
    <rect :width="size" :height="size" :class="LIGHT" />
    <path :d="path" :class="DARK" />
  </svg>
</template>
