import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/app/router.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        // Wave 1 scaffold floor. Ratchet to the QUALITY_BAR target (80/80/75/80)
        // by Wave 3, when the data layer and feature tests exist.
        lines: 50,
        statements: 50,
        functions: 40,
        branches: 40,
      },
    },
  },
})
