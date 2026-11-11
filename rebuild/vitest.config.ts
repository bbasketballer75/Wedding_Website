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
    env: {
      // Deterministic public env for tests; the media resolver test asserts the
      // no-CDN same-origin behavior, so the CDN base must stay unset.
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'ci-placeholder-anon-key',
      VITE_SITE_URL: 'https://www.theporadas.com',
      VITE_MEDIA_BASE_URL: '',
    },
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
        // QUALITY_BAR floor (80/80/75/80). Wave 1 measured 88.8/88.8/79.8/91.4,
        // so the real bar is enforced from the first wave onwards.
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
})
