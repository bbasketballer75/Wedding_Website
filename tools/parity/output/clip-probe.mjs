/* Throwaway clip-semantics test — not a deliverable. */
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = 'http://127.0.0.1:4174'
const browser = await chromium.launch({ headless: true })
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
await page.addInitScript(() => {
  localStorage.setItem(
    'ui-store',
    JSON.stringify({ state: { currentTheme: 'dark', preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false } }, version: 0 })
  )
  const noop = { scope: '/', installing: null, waiting: null, active: null, update: async () => undefined, unregister: async () => true, addEventListener() {}, removeEventListener() {} }
  try {
    Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: async () => noop })
    Object.defineProperty(navigator.serviceWorker, 'getRegistrations', { configurable: true, value: async () => [] })
  } catch {}
})
await page.route('**/*', async route => {
  const request = route.request()
  const url = new URL(request.url())
  if (url.origin === BASE) return route.continue()
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' })
  return route.fulfill({ status: 204, body: '' })
})
await page.clock.setFixedTime(new Date('2026-11-08T17:00:00Z'))
await page.goto(BASE + '/gallery', { waitUntil: 'load', timeout: 30000 })
await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
await page.waitForTimeout(2500)
const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
console.log('page height:', height)
// Variant A: viewport screenshot at scroll 1500
await page.evaluate(() => window.scrollTo(0, 1500))
await page.waitForTimeout(300)
const viewportShot = await page.screenshot()
// Variant B: non-fullPage clip at y=1500 without scrolling
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(300)
const clipShot = await page
  .screenshot({ clip: { x: 0, y: 1500, width: 1440, height: 900 } })
  .catch(error => {
    console.log('clip threw:', error.message)
    return null
  })
if (clipShot) {
  const { data: a } = await sharp(viewportShot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const info = await sharp(viewportShot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const b = await sharp(clipShot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let changed = 0
  for (let i = 0; i < Math.min(a.length, b.data.length); i += 3) {
    if (a[i] !== b.data[i] || a[i + 1] !== b.data[i + 1] || a[i + 2] !== b.data[i + 2]) changed++
  }
  console.log('clip vs scrolled viewport changed px:', changed, '/', info.info.width * info.info.height)
  const scrolledGallery = await page.screenshot()
  await sharp(scrolledGallery).toFile('tools/parity/output/clip-probe-scrolled.png')
  await sharp(clipShot).toFile('tools/parity/output/clip-probe-clip.png')
  console.log('wrote clip-probe-scrolled.png / clip-probe-clip.png')
}
await browser.close()
