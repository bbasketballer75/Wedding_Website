import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: 'http://localhost:4174',
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
    command: 'npm run preview -- --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
