/* Throwaway probe 8: isolate what breaks home mount. */
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4174'
const STUB = fs.readFileSync('public/images/engagement/PoradaProposal-29.webp')
const IMAGE_TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif' }

const variants = [
  { name: 'paused-2025', clock: 'paused', fixed: '2025-05-10T22:00:00Z' },
  { name: 'paused-2026', clock: 'paused', fixed: '2026-11-08T17:00:00Z' },
  { name: 'install-2026', clock: 'install', fixed: '2026-11-08T17:00:00Z' },
  { name: 'install-2025', clock: 'install', fixed: '2025-05-10T22:00:00Z' },
  { name: 'setfixed-2026', clock: 'setfixed', fixed: '2026-11-08T17:00:00Z' },
]

const browser = await chromium.launch({ headless: true })
for (const variant of variants) {
  const fixed = new Date(variant.fixed).getTime()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => {
    window.__E2E__ = true
    localStorage.setItem(
      'ui-store',
      JSON.stringify({ state: { currentTheme: 'dark', preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false } }, version: 0 })
    )
    try {
      const noop = { scope: '/', installing: null, waiting: null, active: null, update: async () => undefined, unregister: async () => true, addEventListener() {}, removeEventListener() {} }
      Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: async () => noop })
      Object.defineProperty(navigator.serviceWorker, 'getRegistrations', { configurable: true, value: async () => [] })
    } catch {
      /* noop */
    }
  })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
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
    if (IMAGE_TYPES[ext]) return route.fulfill({ status: 200, headers: { 'content-type': IMAGE_TYPES[ext], 'access-control-allow-origin': '*' }, body: STUB })
    if (ext === 'js' || ext === 'mjs') return route.fulfill({ status: 200, headers: { 'content-type': 'application/javascript' }, body: '' })
    return route.fulfill({ status: 204, body: '' })
  })
  if (variant.clock === 'paused') {
    await page.clock.install({ time: fixed })
    await page.clock.pauseAt(fixed + 1)
  } else if (variant.clock === 'install') {
    await page.clock.install({ time: fixed })
  } else {
    await page.clock.setFixedTime(new Date(fixed))
  }
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 })
  const immediate = await page.evaluate(() => ({
    h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    sections: document.querySelectorAll('section').length,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 80),
    fakeNow: Date.now(),
  }))
  await page.waitForTimeout(2500)
  const later = await page.evaluate(() => ({
    h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    sections: document.querySelectorAll('section').length,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 80),
    fakeNow: Date.now(),
  }))
  console.log(`${variant.name}: immediate=${JSON.stringify(immediate)} later=${JSON.stringify(later)} errors=${JSON.stringify(errors.slice(0, 3))}`)
  await context.close()
}
await browser.close()
