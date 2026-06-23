/**
 * Visual Playwright config — runs against the live dev server with real Supabase data.
 *
 * Why a separate config?
 *   - The main config (playwright.config.ts) runs against a preview build with fully-mocked
 *     Supabase responses. That's great for CI/functional testing but tells you nothing about
 *     whether real photos, guestbook messages, and CDN media are loading.
 *   - This config targets the running dev server (port 5173) with NO mocks so you see
 *     exactly what a real guest sees.
 *   - It uses headless Chromium so the visual suite can run from CI/agents without
 *     a display. The video background composites black in headless Chromium but we
 *     pause all videos + hide them via CSS in `stabilise()` before snapshotting,
 *     so visual diffs are stable.
 *
 * Usage:
 *   npm run dev               # start the dev server first (required)
 *   npm run test:visual       # run all visual checks
 *   npm run test:visual:ui    # open Playwright UI for interactive inspection
 */
import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv()

export default defineConfig({
  testDir: './tests/e2e-live',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // serial — we share one browser session against the real backend
  timeout: 60000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-visual' }]],

  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      // Slightly more tolerant than the mocked tests — real CDN images can have
      // minor sub-pixel rendering differences between runs.
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    // Real dev server — no mocks, real Supabase, real CDN media
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 30000,
    viewport: { width: 1440, height: 900 },
    // Headless so we can run from CI/agents without a display. The video
    // background composites as a black rectangle in headless Chromium but we
    // pause all videos + hide them via CSS in `stabilise()` before snapshotting,
    // so the visual diffs are stable across headed/headless runs.
    headless: true,
  },

  projects: [
    {
      name: 'visual-desktop',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'visual-mobile',
      use: {
        ...devices['Pixel 5'],
        headless: true,
      },
    },
  ],

  // Dev server must already be running — this config does NOT start it.
  // Run `npm run dev` in a separate terminal first.
  // (We don't auto-start here because the dev server holds real credentials and
  //  we don't want it restarted mid-session unexpectedly.)
})
