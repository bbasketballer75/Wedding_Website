/* Throwaway probe 4: identify home nondeterminism + test media-play override. */
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const FIXED = new Date('2025-05-10T22:00:00Z').getTime()

const prepare = async (page, theme, { freezeMedia }) => {
  await page.addInitScript(
    ({ key, value, freezeMedia }) => {
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
      if (freezeMedia) {
        const stop = el => {
          try {
            el.pause()
            el.muted = true
            el.currentTime = 0
          } catch {
            /* noop */
          }
        }
        HTMLMediaElement.prototype.play = function play() {
          stop(this)
          return Promise.resolve()
        }
        const sweep = root => {
          for (const el of root.querySelectorAll?.('video, audio') ?? []) stop(el)
        }
        const start = () => {
          sweep(document)
          const observer = new MutationObserver(records => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (node.nodeType !== 1) continue
                if (node.matches?.('video, audio')) stop(node)
                sweep(node)
              }
            }
          })
          observer.observe(document.documentElement, { childList: true, subtree: true })
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
        else start()
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
      freezeMedia,
    }
  )
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === BASE) return route.continue()
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
    const host = url.hostname
    if (host.includes('supabase') || /^\/(rest|rpc|auth)\/v\d\//.test(url.pathname)) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify([]),
      })
    }
    if (url.pathname.endsWith('/video/main.vtt')) {
      return route.fulfill({
        status: 206,
        headers: { 'content-type': 'text/vtt', 'access-control-allow-origin': '*' },
        body: 'WEBVTT\n',
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })
}

const capture = async (browser, route, { theme = 'dark', width = 1440, height = 900, freezeMedia = false } = {}) => {
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
  await prepare(page, theme, { freezeMedia })
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
  await page.clock.runFor(2500)
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
    await page.waitForTimeout(60)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  const info = await page.evaluate(() => ({
    imgs: document.images.length,
    incomplete: [...document.images].filter(img => !img.complete).length,
    videos: [...document.querySelectorAll('video')].map(v => ({
      paused: v.paused,
      t: Number(v.currentTime.toFixed(2)),
      rs: v.readyState,
      src: (v.currentSrc || v.src || '').slice(-40),
    })),
    audio: [...document.querySelectorAll('audio')].map(a => ({ paused: a.paused })),
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
  const w = info.width
  for (let i = 0; i < Math.min(da.length, db.length); i += 3) {
    if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) changed++
  }
  const { data: diff, info: di } = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < diff.length; i += 3) {
    if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) {
      diff[i] = 255
      diff[i + 1] = 0
      diff[i + 2] = 255
    } else {
      diff[i] = Math.round(diff[i] * 0.3)
      diff[i + 1] = Math.round(diff[i + 1] * 0.3)
      diff[i + 2] = Math.round(diff[i + 2] * 0.3)
    }
  }
  return { changed, total: info.width * info.height, diff: { data: diff, width: di.width, height: di.height, channels: di.channels } }
}

const browser = await chromium.launch({ headless: true })
for (const freezeMedia of [false, true]) {
  for (const route of ['/', '/film']) {
    const label = `${route} freezeMedia=${freezeMedia}`
    try {
      const a = await capture(browser, route, { freezeMedia })
      const b = await capture(browser, route, { freezeMedia })
      const same = Buffer.compare(a.shot, b.shot) === 0
      const stats = same ? { changed: 0 } : await diffStats(a.shot, b.shot)
      if (!same) {
        const name = route === '/' ? 'home' : 'film'
        await sharp(stats.diff.data, {
          raw: { width: stats.diff.width, height: stats.diff.height, channels: stats.diff.channels },
        })
          .png()
          .toFile(`tools/parity/output/probe4-${name}-${freezeMedia}.png`)
      }
      console.log(
        `${label}: equal=${same} changed=${stats.changed}/${stats.total ?? '?'} videos=${JSON.stringify(a.info.videos)} ms=${a.elapsed}/${b.elapsed}`
      )
    } catch (error) {
      console.log(`${label} ERROR: ${error.message}`)
    }
  }
}
await browser.close()
