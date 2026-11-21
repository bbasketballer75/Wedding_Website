/** Stage-by-stage replication of captureShot to find when twitter meta goes stale. */
import { chromium } from 'playwright'
import {
  preparePage,
  installNetworkMocks,
  createMockState,
  loadMediaStub,
} from '../mocks/index.mjs'
import { loadFixtures } from '../mocks/fixtures.mjs'
import { CAPTURE } from '../config.mjs'

const fixtures = await loadFixtures({})
const mediaStub = await loadMediaStub()
const browser = await chromium.launch({ headless: true })
const baseUrl = 'http://127.0.0.1:4174'
const routePath = '/gallery'
const fixedNow = '2026-11-08T17:00:00.000Z'

const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 }
const theme = 'dark'

// warm-up context (same as capture.mjs)
const warmContext = await browser.newContext({
  viewport: { width: viewport.width, height: viewport.height },
  deviceScaleFactor: 1,
  locale: 'en-US',
  timezoneId: 'America/New_York',
  colorScheme: theme,
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
})
const warm = await warmContext.newPage()
await preparePage(warm, { theme, mode: 'public', fixtures: fixtures.data })
await installNetworkMocks(warm, {
  baseUrl,
  mode: 'public',
  fixtures: fixtures.data,
  mediaStub,
  state: createMockState(),
})
await warm.clock.install({ time: new Date(fixedNow) })
await warm.goto(baseUrl + routePath, { waitUntil: 'load', timeout: 30000 })
await warm.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
await warm.waitForTimeout(500)
await warm.close()

const context = warmContext
const page = await context.newPage()
await preparePage(page, { theme, mode: 'public', fixtures: fixtures.data })
await installNetworkMocks(page, {
  baseUrl,
  mode: 'public',
  fixtures: fixtures.data,
  mediaStub,
  state: createMockState(),
})
await page.clock.install({ time: new Date(fixedNow) })
await page.clock.pauseAt(new Date(fixedNow).getTime() + 1)

const dump = async label => {
  const info = await page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    twitter: document.querySelector('meta[name="twitter:title"]')?.content ?? null,
    desc: document.querySelector('meta[name="description"]')?.content ?? null,
    og: document.querySelector('meta[property="og:title"]')?.content ?? null,
  }))
  console.log(label, JSON.stringify(info))
}

const response = await page.goto(baseUrl + routePath, { waitUntil: 'load', timeout: 45000 })
await page.clock.runFor(1200)
await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
await dump('after networkidle')
for (let i = 0; i < 150; i += 1) {
  const ready = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const text = (main?.textContent ?? '').replace(/\s+/g, ' ').trim()
    return (main?.querySelectorAll('*') ?? []).length >= 3 && text.length >= 40
  })
  if (ready) break
  await page.waitForTimeout(100)
}
await page.evaluate(async () => {
  if ('fonts' in document) await document.fonts.ready
})
await page.clock.runFor(600)
await dump('after content+fonts+600')
await page.addStyleTag({
  content:
    '*,*::before,*::after{animation-delay:0s !important;animation-duration:0s !important;animation-iteration-count:1 !important;transition-delay:0s !important;transition-duration:0s !important;caret-color:transparent !important}html{scrollbar-gutter:stable !important;scrollbar-width:none !important}',
})
await page.evaluate(() => {
  for (const video of document.querySelectorAll('video')) {
    video.pause()
    video.muted = true
    video.currentTime = 0
  }
  document.documentElement.style.overflow = 'auto'
  document.documentElement.style.scrollbarGutter = 'stable'
})
await dump('after freeze layout')
const height = await page.evaluate(() =>
  Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)
)
for (let y = 0; y < Math.min(height, 30000); y += CAPTURE.scrollStepPx) {
  await page.evaluate(position => window.scrollTo(0, position), y)
  await page.clock.runFor(48).catch(() => {})
  await page.waitForTimeout(80)
}
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(150)
await dump('after lazy sweep')
await page.clock.runFor(1500)
await page.waitForTimeout(150)
await dump('after final runFor')
for (let index = 0; index < 8; index += 1) {
  await page.evaluate(position => window.scrollTo(0, position), Math.min(index * 900, Math.max(0, height - 900)))
  await page.waitForTimeout(120)
  await page.clock.runFor(900).catch(() => {})
  await page.waitForTimeout(120)
}
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(80)
await dump('after windows')
const twitterTags = await page.evaluate(() =>
  [...document.querySelectorAll('meta')]
    .filter(tag => (tag.getAttribute('name') || tag.getAttribute('property') || '').includes('twitter'))
    .map(tag => ({
      name: tag.getAttribute('name'),
      property: tag.getAttribute('property'),
      content: (tag.getAttribute('content') || '').slice(0, 80),
      inHead: tag.closest('head') !== null,
    }))
)
console.log('twitter tags:', JSON.stringify(twitterTags, null, 1))
const extraction = await page.evaluate(() => {
  const meta = {}
  for (const tag of document.querySelectorAll('meta[name], meta[property]')) {
    const key = tag.getAttribute('name') ?? tag.getAttribute('property')
    if (!key || key in meta) continue
    meta[key] = (tag.getAttribute('content') ?? '').trim()
  }
  return { title: document.title, twitterTitle: meta['twitter:title'], metaCount: Object.keys(meta).length }
})
console.log('extraction:', JSON.stringify(extraction))
await context.close()
await browser.close()

