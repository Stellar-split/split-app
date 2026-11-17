import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts', './src/__tests__/setup.ts'],
    mockReset: true,
    clearMocks: true,
    exclude: ['e2e/**', 'node_modules/**'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    server: {
      deps: {
        inline: ['@stellar/freighter-api', '@stellar-split/sdk'],
        external: ['@ledgerhq/hw-transport-webhid', '@ledgerhq/hw-app-str'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/contexts/AccessibilityContext': path.resolve(__dirname, './src/__mocks__/contexts/AccessibilityContext.tsx'),
      '@/contexts/WalletContext': path.resolve(__dirname, './src/__mocks__/contexts/WalletContext.tsx'),
      '@/context/ToastContext': path.resolve(__dirname, './src/__mocks__/context/ToastContext.tsx'),
    },
  },
});