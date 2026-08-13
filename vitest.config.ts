import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // `.test.mjs` files under homelab/ are plain `node:test` suites for the
    // scripts that run on the HA box — they run with `node --test`, not here.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.mjs'],
  },
})
