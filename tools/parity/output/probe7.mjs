/* Throwaway probe 7: debug probe6's collapsed home. */
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4174'
const FIXED = new Date('2026-11-08T17:00:00.000Z').getTime()
const STUB = fs.readFileSync('public/images/engagement/PoradaProposal-29.webp')
const IMAGE_TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif' }

const browser = await chromium.launch({ headless: true })
for (const variant of ['fixed2025-realTimers', 'fixed2026-paused', 'fixed2026-realTimers']) {
  const theme = 'dark'
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: theme,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })
  await page.addInitScript(({ theme }) => {
    window.__E2E__ = true
    localStorage.setItem(
      'ui-store',
      JSON.stringify({ state: { currentTheme: theme, preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false } }, version: 0 })
    )
  }, { theme })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
    if (url.pathname.endsWith('/video/main.vtt')) return route.fulfill({ status: 206, headers: { 'content-type': 'text/vtt', 'access-control-allow-origin': '*' }, body: 'WEBVTT\n' })
    if (url.pathname.includes('/guest-upload-url')) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' })
    if (url.hostname === 'mock-r2.example.com') return route.fulfill({ status: 200, body: '' })
    if (url.hostname.includes('supabase') || /^\/(rest|rpc|auth)\/v\d\//.test(url.pathname)) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '[]' })
    }
    if (url.origin === BASE) return route.continue()
    const ext = url.pathname.split('.').pop()?.toLowerCase() ?? ''
    if (IMAGE_TYPES[ext]) {
      return route.fulfill({ status: 200, headers: { 'content-type': IMAGE_TYPES[ext], 'access-control-allow-origin': '*' }, body: STUB })
    }
    if (ext === 'js' || ext === 'mjs') return route.fulfill({ status: 200, headers: { 'content-type': 'application/javascript' }, body: '' })
    return route.fulfill({ status: 204, body: '' })
  })
  const fixed = variant === 'fixed2025-realTimers' ? new Date('2025-05-10T22:00:00Z').getTime() : FIXED
  if (variant.endsWith('paused')) {
    await page.clock.install({ time: fixed })
    await page.clock.pauseAt(fixed + 1)
  } else {
    await page.clock.setFixedTime(new Date(fixed))
  }
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.evaluate(async () => { if ('fonts' in document) await document.fonts.ready })
  const before = await page.evaluate(() => ({
    url: location.pathname,
    h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
    sections: document.querySelectorAll('section').length,
    mainChildren: document.querySelector('main')?.children.length ?? -1,
    errorUi: Boolean(document.querySelector('[role=alert]')),
  }))
  await page.waitForTimeout(1200)
  const after = await page.evaluate(() => ({
    url: location.pathname,
    h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
    sections: document.querySelectorAll('section').length,
  }))
  console.log(`\n=== ${variant} ===`)
  console.log('before:', JSON.stringify(before))
  console.log('after :', JSON.stringify(after))
  console.log('errors:', errors.slice(0, 6))
  await page.screenshot({ path: `tools/parity/output/probe7-${variant}.png`, fullPage: false })
  await context.close()
}
await browser.close()
