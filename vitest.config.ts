import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts', './src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // Watch mode (`npm run test:watch`) re-runs only the tests affected by
    // changed files, using this cache to know which files changed since the
    // last run and to skip collecting unaffected suites.
    cache: {
      dir: 'node_modules/.vitest-cache',
    },
    // Reruns the whole suite on changes to shared config/setup, since those
    // can affect any test regardless of which source files it imports.
    forceRerunTriggers: [
      '**/vitest.config.*',
      '**/vitest.setup.*',
      '**/package.json',
    ],
    server: {
      deps: {
        inline: ['@stellar/freighter-api', '@stellar-split/sdk'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
