import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ quiet: true })

// Deterministic build inputs for the mocked public suite. Without these, a run
// in a checkout with no `.env` builds the app with an empty media base, so
// media-URL assertions fail for reasons that have nothing to do with the code
// under test. Values are public placeholders: the Supabase host is unroutable
// and every request to it is intercepted in tests/e2e/support/publicSite.ts.
// A developer's real `.env` still wins, because loadEnv() runs first.
process.env.VITE_SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY ||= 'ci-placeholder-anon-key'
process.env.VITE_MEDIA_BASE_URL ||= 'https://media.wedding.theporadas.com'
process.env.VITE_SITE_URL ||= 'https://www.theporadas.com'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Single-worker in CI to avoid vite-preview port/HMR contention with
  // N parallel browsers (sequential run is ~3x slower wall time but reliable).
  // Local dev keeps the 3-worker default for fast feedback.
  workers: process.env.CI ? 1 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on',
    screenshot: 'on',
    actionTimeout: 15000,
    navigationTimeout: 20000,
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
})
