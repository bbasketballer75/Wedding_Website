/**
 * Visual regression config — production target.
 *
 * Runs the same visual suite as `playwright.config.visual.ts` but
 * against the LIVE Netlify deployment at https://www.theporadas.com
 * instead of a local dev server. This is what a real visitor sees.
 *
 * Usage:
 *   npx playwright test --config playwright.config.visual-prod.ts
 *   npx playwright test --config playwright.config.visual-prod.ts --update-snapshots
 *
 * Differences from the localhost config:
 *   - baseURL is the live Netlify URL
 *   - No `webServer` block — the site is already running
 *   - Reports go to `playwright-report-visual-prod/` (separate from local)
 *   - Same screenshots dir as the local config, so visual diffs are
 *     shared (you can compare against the same baseline regardless of
 *     whether the last run was local or prod)
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-live',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-visual-prod' }]],

  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    // Live Netlify deployment — what a real guest sees.
    baseURL: 'https://www.theporadas.com',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 30000,
    viewport: { width: 1440, height: 900 },
    headless: true,
  },

  projects: [
    {
      name: 'visual-prod-desktop',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'visual-prod-mobile',
      use: {
        ...devices['Pixel 5'],
        headless: true,
      },
    },
  ],
})
