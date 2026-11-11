import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      // Pure functions: formatting, localisation fallback, colour contrast. Fast, plain Node.
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
        },
      },
      // Components mounted inside a real Nuxt app (i18n, Nuxt UI, auto-imports).
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/components/**/*.spec.ts'],
          environment: 'nuxt',
          environmentOptions: { nuxt: { domEnvironment: 'happy-dom' } },
        },
      }),
    ],
  },
})
