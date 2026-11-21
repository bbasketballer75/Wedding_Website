/* Throwaway probe 5: locate + identify home nondeterministic elements. */
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const FIXED = new Date('2025-05-10T22:00:00Z').getTime()
const OUT = 'tools/parity/output'

const initScript = ({ theme }) => {
  window.__E2E__ = true
  localStorage.setItem(
    'ui-store',
    JSON.stringify({
      state: { currentTheme: theme, preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false } },
      version: 0,
    })
  )
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
  await context.addInitScript(initScript, { theme })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === BASE) return route.continue()
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
    if (url.hostname.includes('supabase') || /^\/(rest|rpc|auth)\/v\d\//.test(url.pathname)) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '[]' })
    }
    if (url.pathname.endsWith('/video/main.vtt')) {
      return route.fulfill({ status: 206, headers: { 'content-type': 'text/vtt', 'access-control-allow-origin': '*' }, body: 'WEBVTT\n' })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await page.clock.install({ time: FIXED })
  await page.clock.pauseAt(FIXED + 1)
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
  const shot = await page.screenshot({ fullPage: true, caret: 'hide', animations: 'disabled', scale: 'css' })
  // identify elements at changed coordinates (discover after shot from caller via page? keep page open until identified)
  const identify = async coords => {
    const results = []
    for (const { x, y } of coords) {
      await page.evaluate(pos => window.scrollTo(0, Math.max(0, pos - 300)), y)
      await page.waitForTimeout(120)
      const info = await page.evaluate(
        ({ x, y }) => {
          const scrollY = window.scrollY
          const el = document.elementFromPoint(x, y - scrollY)
          const chain = []
          let node = el
          while (node && chain.length < 6) {
            chain.push(
              `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${node.className && typeof node.className === 'string' ? '.' + node.className.split(/\s+/).slice(0, 3).join('.') : ''}`
            )
            node = node.parentElement
          }
          const attrs = el ? [...el.attributes].map(a => `${a.name}=${a.value.slice(0, 80)}`).slice(0, 6) : []
          const styles = el ? window.getComputedStyle(el) : null
          return { chain, attrs, anim: styles?.animation, transform: styles?.transform?.slice(0, 80), opacity: styles?.opacity }
        },
        { x, y }
      )
      results.push(info)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    return results
  }
  return { shot, pageHeight, identify, close: () => context.close() }
}

const browser = await chromium.launch({ headless: true })
const a = await capture(browser, '/')
const b = await capture(browser, '/')
const { data: da, info } = await sharp(a.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { data: db } = await sharp(b.shot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const w = info.width
const changed = []
for (let i = 0; i < Math.min(da.length, db.length); i += 3) {
  if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) {
    const p = i / 3
    changed.push({ x: p % w, y: Math.floor(p / w) })
  }
}
console.log(`changed=${changed.length} total=${info.width * info.height}`)
// cluster into 60px buckets
const buckets = new Map()
for (const { x, y } of changed) {
  const key = `${Math.floor(x / 60)}:${Math.floor(y / 60)}`
  const cur = buckets.get(key) ?? { n: 0, x: 0, y: 0 }
  cur.n++
  cur.x += x
  cur.y += y
  buckets.set(key, cur)
}
const top = [...buckets.values()]
  .sort((p, q) => q.n - p.n)
  .slice(0, 10)
  .map(v => ({ x: Math.round(v.x / v.n), y: Math.round(v.y / v.n), n: v.n }))
console.log('top clusters:', JSON.stringify(top))
const identified = await a.identify(top.slice(0, 6).map(({ x, y }) => ({ x, y })))
identified.forEach((r, idx) => console.log(`cluster ${idx} @${JSON.stringify(top[idx])}:`, JSON.stringify(r)))
await a.close()
await b.close()

// crops side by side (A|B) at 3x
const crops = []
for (const [idx, point] of top.slice(0, 4).entries()) {
  const size = 160
  const left = Math.max(0, Math.min(info.width - size, point.x - size / 2))
  const top2 = Math.max(0, Math.min(info.height - size, point.y - size / 2))
  const ca = await sharp(a.shot).extract({ left, top: top2, width: size, height: size }).resize(size * 3, size * 3, { kernel: 'nearest' }).png().toBuffer()
  const cb = await sharp(b.shot).extract({ left, top: top2, width: size, height: size }).resize(size * 3, size * 3, { kernel: 'nearest' }).png().toBuffer()
  crops.push({ ca, cb })
}
const canvas = sharp({ create: { width: 480 * 2 + 20, height: (480 + 10) * crops.length, channels: 3, background: '#222' } })
const composites = []
crops.forEach((crop, idx) => {
  composites.push({ input: crop.ca, left: 0, top: idx * 490 })
  composites.push({ input: crop.cb, left: 490, top: idx * 490 })
})
await canvas.composite(composites).jpeg({ quality: 92 }).toFile(`${OUT}/probe5-crops.jpg`)
console.log('wrote probe5-crops.jpg')
await browser.close()
