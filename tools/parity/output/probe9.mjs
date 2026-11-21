/* Throwaway probe 9: two-phase warm-load strategies. */
import { chromium } from 'playwright'
import fs from 'node:fs'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const FIXED = new Date('2026-11-08T17:00:00.000Z').getTime()
const STUB = fs.readFileSync('public/images/engagement/PoradaProposal-29.webp')
const IMAGE_TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif' }

const installMocks = async (page, theme) => {
  await page.addInitScript(
    ({ theme }) => {
      window.__E2E__ = true
      localStorage.setItem(
        'ui-store',
        JSON.stringify({ state: { currentTheme: theme, preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false } }, version: 0 })
      )
      try {
        const noop = { scope: '/', installing: null, waiting: null, active: null, update: async () => undefined, unregister: async () => true, addEventListener() {}, removeEventListener() {} }
        Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: async () => noop })
        Object.defineProperty(navigator.serviceWorker, 'getRegistrations', { configurable: true, value: async () => [] })
      } catch {
        /* noop */
      }
    },
    { theme }
  )
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
    if (IMAGE_TYPES[ext]) return route.fulfill({ status: 200, headers: { 'content-type': IMAGE_TYPES[ext], 'access-control-allow-origin': '*' }, body: STUB })
    if (ext === 'js' || ext === 'mjs') return route.fulfill({ status: 200, headers: { 'content-type': 'application/javascript' }, body: '' })
    return route.fulfill({ status: 204, body: '' })
  })
}

const settle = async page => {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.evaluate(async () => { if ('fonts' in document) await document.fonts.ready })
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;animation-iteration-count:1 !important;transition-duration:0s !important;transition-delay:0s !important;caret-color:transparent !important}',
  })
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith('video-progress-')) window.localStorage.removeItem(key)
    for (const video of document.querySelectorAll('video')) {
      video.pause()
      video.muted = true
      video.currentTime = 0
      video.dispatchEvent(new Event('timeupdate'))
    }
    for (const audio of document.querySelectorAll('audio')) { audio.pause(); audio.muted = true }
    const root = document.documentElement
    root.style.overflow = 'auto'
    root.style.scrollbarGutter = 'stable'
  })
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, document.documentElement.offsetHeight))
  for (let y = 0; y < Math.min(height, 30000); y += 600) {
    await page.evaluate(pos => window.scrollTo(0, pos), y)
    await page.waitForTimeout(80)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  for (let i = 0; i < 30; i += 1) {
    const pending = await page.evaluate(() => [...document.images].filter(img => !img.complete).length)
    if (pending === 0) break
    await page.waitForTimeout(100)
  }
  return height
}

const captureWarmFreshPage = async (browser, route, theme, width, height) => {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'America/New_York',
    colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block',
  })
  // warm-up page: running (fake) clock so the app fully mounts
  const warm = await context.newPage()
  await installMocks(warm, theme)
  await warm.clock.install({ time: FIXED })
  await warm.goto(BASE + route, { waitUntil: 'load', timeout: 30000 })
  await warm.waitForTimeout(2500)
  const warmState = await warm.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0))
  await warm.close()
  // capture page: paused clock from before navigation
  const page = await context.newPage()
  await installMocks(page, theme)
  await page.clock.install({ time: FIXED })
  await page.clock.pauseAt(FIXED + 1)
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 })
  await page.clock.runFor(1500)
  const height0 = await settle(page)
  await page.clock.runFor(2000)
  const info = await page.evaluate(() => ({
    h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    sections: document.querySelectorAll('section').length,
    imgs: document.images.length,
    incomplete: [...document.images].filter(i => !i.complete).length,
    fakeNow: Date.now(),
  }))
  const shot = await page.screenshot({ fullPage: true, caret: 'hide', animations: 'disabled', scale: 'css' })
  await context.close()
  return { shot, warmState, height0, info }
}

const compare = async (a, b) => {
  const { data: da, info } = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { data: db } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let changed = 0
  for (let i = 0; i < Math.min(da.length, db.length); i += 3) {
    if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) changed++
  }
  return { changed, total: info.width * info.height }
}

const browser = await chromium.launch({ headless: true })
for (const [route, opts] of [['/', {}], ['/', { theme: 'light' }], ['/film', {}], ['/gallery', {}]]) {
  const label = `${route} ${opts.theme ?? 'dark'}`
  try {
    const a = await captureWarmFreshPage(browser, route, opts.theme ?? 'dark', 1440, 900)
    const b = await captureWarmFreshPage(browser, route, opts.theme ?? 'dark', 1440, 900)
    const r = await compare(a.shot, b.shot)
    console.log(`${label}: warmH=${a.warmState} settleH=${a.height0} info=${JSON.stringify(a.info)} changed=${r.changed}/${r.total}`)
  } catch (error) {
    console.log(`${label} ERROR: ${error.message}`)
  }
}
await browser.close()
