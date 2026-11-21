/* Throwaway determinism probe — not a deliverable. */
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const THEME_KEY = 'ui-store'

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
        Object.defineProperty(navigator.serviceWorker, 'register', {
          configurable: true,
          value: async () => noopRegistration,
        })
        Object.defineProperty(navigator.serviceWorker, 'getRegistrations', {
          configurable: true,
          value: async () => [],
        })
      } catch {
        /* noop */
      }
    },
    {
      key: THEME_KEY,
      value: JSON.stringify({
        state: {
          currentTheme: theme,
          preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false },
        },
        version: 0,
      }),
    }
  )
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
  await page.clock.setFixedTime(new Date('2025-05-10T22:00:00Z'))
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === BASE) return route.continue()
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
    const host = url.hostname
    if (host.includes('supabase') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/rpc/')) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: '[]',
      })
    }
    if (host === 'media.wedding.theporadas.com' || host === 'media.wedding.theporadas.com') {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'image/webp' },
        body: Buffer.from(''),
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })
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
  await page.waitForTimeout(700)
  // pause media
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
    Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
      document.documentElement.offsetHeight
    )
  )
  // lazy sweep
  const step = 600
  const maxY = Math.min(pageHeight, 30000)
  for (let y = 0; y < maxY; y += step) {
    await page.evaluate(pos => window.scrollTo(0, pos), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  const loaded = await page.evaluate(() => ({
    imgs: document.images.length,
    incomplete: [...document.images].filter(img => !img.complete).length,
    theme: document.documentElement.dataset.theme,
    cls: document.documentElement.className,
  }))
  const shot = await page.screenshot({ fullPage: true, caret: 'hide', animations: 'disabled', scale: 'css' })
  const elapsed = Date.now() - started
  await context.close()
  return { shot, height: pageHeight, loaded, elapsed }
}

const browser = await chromium.launch({ headless: true })
const routes = ['/', '/film', '/gallery', '/guestbook', '/upload', '/guest-photos', '/activity', '/print']
for (const route of routes) {
  try {
    const a = await capture(browser, route)
    const b = await capture(browser, route)
    const same = Buffer.compare(a.shot, b.shot) === 0
    let changed = 'n/a'
    if (!same) {
      const { data: rawA, info } = await sharp(a.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const { data: rawB } = await sharp(b.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      let diff = 0
      const px = info.width * info.height
      for (let i = 0; i < Math.min(rawA.length, rawB.length); i += 3) {
        if (rawA[i] !== rawB[i] || rawA[i + 1] !== rawB[i + 1] || rawA[i + 2] !== rawB[i + 2]) diff++
      }
      changed = `${diff}/${px} = ${(diff / px * 100).toFixed(3)}%`
    }
    console.log(
      `${route} theme=${a.loaded.theme} h=${a.height} imgs=${a.loaded.imgs}(inc ${a.loaded.incomplete}) bytesEqual=${same} changed=${changed} ms=${a.elapsed}/${b.elapsed}`
    )
  } catch (error) {
    console.log(`${route} ERROR: ${error.message}`)
  }
}
await browser.close()

