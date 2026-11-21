/* Throwaway clock-strategy probe — not a deliverable. */
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const FIXED = new Date('2025-05-10T22:00:00Z').getTime()

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
      key: 'ui-store',
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
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === BASE) return route.continue()
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
    const host = url.hostname
    if (host.includes('supabase') || /^\/(rest|rpc|auth)\/v\d\//.test(url.pathname)) {
      const body = url.pathname.includes('/video/main.vtt')
        ? ''
        : JSON.stringify([])
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body })
    }
    if (url.pathname.endsWith('/video/main.vtt')) {
      return route.fulfill({ status: 206, headers: { 'content-type': 'text/vtt', 'access-control-allow-origin': '*' }, body: 'WEBVTT\n' })
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
  await page.clock.install({ time: FIXED })
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
  // deterministic fake-time advance: completes framer transitions, fires intervals N times exactly
  await page.clock.runFor(1200)
  // freeze
  await page.clock.pauseAt(FIXED + 1300)
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
  const step = 600
  const maxY = Math.min(pageHeight, 30000)
  for (let y = 0; y < maxY; y += step) {
    await page.evaluate(pos => window.scrollTo(0, pos), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  const info = await page.evaluate(() => ({
    imgs: document.images.length,
    incomplete: [...document.images].filter(img => !img.complete).length,
    natural: [...document.images].filter(img => img.complete && img.naturalWidth === 0).length,
    theme: document.documentElement.dataset.theme,
    cls: document.documentElement.className,
  }))
  const shot = await page.screenshot({ fullPage: true, caret: 'hide', animations: 'disabled', scale: 'css' })
  const elapsed = Date.now() - started
  await context.close()
  return { shot, pageHeight, info, elapsed }
}

const diffStats = async (a, b) => {
  const { data: da, info } = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { data: db } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let changed = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  const w = info.width
  for (let i = 0; i < Math.min(da.length, db.length); i += 3) {
    if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) {
      changed++
      const p = i / 3
      const x = p % w
      const y = Math.floor(p / w)
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return { changed, total: info.width * info.height, bbox: changed ? { minX, minY, maxX, maxY } : null }
}

const browser = await chromium.launch({ headless: true })
for (const [route, opts] of [
  ['/', {}],
  ['/', { theme: 'light' }],
  ['/', { width: 390, height: 844 }],
  ['/film', {}],
  ['/gallery', {}],
]) {
  const label = `${route} ${opts.theme ?? 'dark'} ${opts.width ?? 1440}`
  try {
    const a = await capture(browser, route, opts)
    const b = await capture(browser, route, opts)
    const same = Buffer.compare(a.shot, b.shot) === 0
    const stats = same ? { changed: 0 } : await diffStats(a.shot, b.shot)
    if (!same) {
      const { data: da, info } = await sharp(a.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const { data: db } = await sharp(b.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const { data: diff, info: di } = await sharp(a.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      for (let i = 0; i < diff.length; i += 3) {
        if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) {
          diff[i] = 255
          diff[i + 1] = 0
          diff[i + 2] = 255
        } else {
          diff[i] = Math.round(diff[i] * 0.35)
          diff[i + 1] = Math.round(diff[i + 1] * 0.35)
          diff[i + 2] = Math.round(diff[i + 2] * 0.35)
        }
      }
      const name = route === '/' ? 'home' : route.slice(1)
      await sharp(diff, { raw: { width: di.width, height: di.height, channels: di.channels } })
        .png()
        .toFile(`tools/parity/output/probe-${name}-${opts.theme ?? 'dark'}-${opts.width ?? 1440}.png`)
    }
    console.log(
      `${label}: h=${a.pageHeight} imgs=${a.info.imgs}(inc ${a.info.incomplete}, broken ${a.info.natural}) theme=${a.info.theme} equal=${same} changed=${stats.changed}%_bbox=${JSON.stringify(stats.bbox)} ms=${a.elapsed}/${b.elapsed}`
    )
  } catch (error) {
    console.log(`${label} ERROR: ${error.message}`)
  }
}
await browser.close()
