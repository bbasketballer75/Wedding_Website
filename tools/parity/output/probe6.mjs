/* Throwaway probe 6: refined deterministic recipe with proper media stubs. */
import { chromium } from 'playwright'
import fs from 'node:fs'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const FIXED = new Date('2026-11-08T17:00:00.000Z').getTime()
const OUT = 'tools/parity/output'
const STUB = fs.readFileSync('public/images/engagement/PoradaProposal-29.webp')
const IMAGE_TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif' }
const MEDIA_HOST = 'media.wedding.theporadas.com'

const prepare = async (page, theme) => {
  await page.addInitScript(
    ({ key, value }) => {
      window.__E2E__ = true
      localStorage.setItem(key, value)
      try {
        const noopRegistration = {
          scope: '/',
          installing: null,
          waiting: null,
          active: null,
          update: async () => undefined,
          unregister: async () => true,
          addEventListener() {},
          removeEventListener() {},
        }
        Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: async () => noopRegistration })
        Object.defineProperty(navigator.serviceWorker, 'getRegistrations', { configurable: true, value: async () => [] })
      } catch {
        /* noop */
      }
    },
    {
      key: 'ui-store',
      value: JSON.stringify({
        state: { currentTheme: theme, preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false } },
        version: 0,
      }),
    }
  )
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
    if (url.pathname.endsWith('/video/main.vtt')) {
      return route.fulfill({ status: 206, headers: { 'content-type': 'text/vtt', 'access-control-allow-origin': '*' }, body: 'WEBVTT\n' })
    }
    if (url.pathname.includes('/guest-upload-url')) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadUrl: 'https://mock-r2.example.com/x.png', publicUrl: 'https://mock-r2.example.com/x.png' }),
      })
    }
    if (url.hostname === 'mock-r2.example.com') return route.fulfill({ status: 200, body: '' })
    if (url.hostname.includes('supabase') || /^\/(rest|rpc|auth)\/v\d\//.test(url.pathname)) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '[]' })
    }
    if (url.origin === BASE) return route.continue()
    const ext = url.pathname.split('.').pop()?.toLowerCase() ?? ''
    const imageType = IMAGE_TYPES[ext]
    if (imageType) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': imageType, 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
        body: STUB,
      })
    }
    if (ext === 'js' || ext === 'mjs') return route.fulfill({ status: 200, headers: { 'content-type': 'application/javascript' }, body: '' })
    return route.fulfill({ status: 204, body: '' })
  })
}

const waitImages = async page => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pending = await page.evaluate(() => [...document.images].filter(img => !img.complete).length)
    if (pending === 0) return true
    await page.waitForTimeout(100)
  }
  return false
}

const capture = async (browser, route, { theme = 'dark', width = 1440, height = 900 } = {}) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: theme,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  await prepare(page, theme)
  await page.clock.install({ time: FIXED })
  await page.clock.pauseAt(FIXED + 1)
  const started = Date.now()
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready
  })
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;animation-iteration-count:1 !important;transition-duration:0s !important;transition-delay:0s !important;caret-color:transparent !important}',
  })
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('video-progress-')) window.localStorage.removeItem(key)
    }
    for (const video of document.querySelectorAll('video')) {
      video.pause()
      video.muted = true
      video.currentTime = 0
      video.dispatchEvent(new Event('timeupdate'))
    }
    for (const audio of document.querySelectorAll('audio')) {
      audio.pause()
      audio.muted = true
    }
    const root = document.documentElement
    root.style.overflow = 'auto'
    root.style.scrollbarGutter = 'stable'
  })
  const pageHeight = await page.evaluate(() =>
    Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, document.documentElement.offsetHeight)
  )
  for (let y = 0; y < Math.min(pageHeight, 30000); y += 600) {
    await page.evaluate(pos => window.scrollTo(0, pos), y)
    await page.waitForTimeout(80)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  await waitImages(page)
  await page.clock.runFor(3000)
  const info = await page.evaluate(() => ({
    imgs: document.images.length,
    incomplete: [...document.images].filter(img => !img.complete).length,
    broken: [...document.images].filter(img => img.complete && img.naturalWidth === 0).length,
    theme: document.documentElement.dataset.theme,
  }))
  const shot = await page.screenshot({ fullPage: true, caret: 'hide', animations: 'disabled', scale: 'css' })
  const elapsed = Date.now() - started
  await context.close()
  return { shot, pageHeight, info, elapsed }
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
for (const [route, opts] of [
  ['/', {}],
  ['/', { theme: 'light' }],
  ['/', { width: 390, height: 844 }],
  ['/film', {}],
  ['/gallery', {}],
  ['/guestbook', {}],
  ['/upload', {}],
]) {
  const label = `${route} ${opts.theme ?? 'dark'} ${opts.width ?? 1440}`
  try {
    const shots = []
    for (let i = 0; i < 3; i += 1) shots.push(await capture(browser, route, opts))
    const r12 = await compare(shots[0].shot, shots[1].shot)
    const r13 = await compare(shots[0].shot, shots[2].shot)
    console.log(
      `${label}: h=${shots[0].pageHeight} imgs=${shots[0].info.imgs}(inc ${shots[0].info.incomplete} broken ${shots[0].info.broken}) theme=${shots[0].info.theme} run1-2=${r12.changed} run1-3=${r13.changed} ms=${shots.map(s => s.elapsed).join('/')}`
    )
  } catch (error) {
    console.log(`${label} ERROR: ${error.message}`)
  }
}
await browser.close()
