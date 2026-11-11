// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Components must stay presentational and typed.
    'vue/require-explicit-emits': 'error',
    'vue/no-v-html': 'error',
  },
}).append({
  // Generated / vendored
  ignores: ['.output/**', '.nuxt/**', 'playwright-report/**', 'test-results/**'],
})
