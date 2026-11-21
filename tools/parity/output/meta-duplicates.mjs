import { chromium } from 'playwright'
import { preparePage, installNetworkMocks, createMockState } from '../mocks/index.mjs'
import { loadFixtures } from '../mocks/fixtures.mjs'
import { loadMediaStub } from '../mocks/index.mjs'

const fixtures = await loadFixtures({})
const mediaStub = await loadMediaStub()
const browser = await chromium.launch({ headless: true })

async function probe(baseUrl, path, mode) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  await preparePage(page, { theme: 'dark', mode: 'public', fixtures: fixtures.data })
  await installNetworkMocks(page, {
    baseUrl,
    mode: 'public',
    fixtures: fixtures.data,
    mediaStub,
    state: createMockState(),
  })
  if (mode === 'paused') {
    await page.clock.install({ time: new Date('2026-11-08T17:00:00Z') })
    await page.clock.pauseAt(new Date('2026-11-08T17:00:00Z').getTime() + 1)
  } else {
    await page.clock.setFixedTime(new Date('2026-11-08T17:00:00Z'))
  }
  await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 30000 })
  await page.clock.runFor(1200)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  for (let i = 0; i < 100; i += 1) {
    const ready = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return (main?.querySelectorAll('*') ?? []).length >= 3
    })
    if (ready) break
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(500)
  const info = await page.evaluate(() => {
    const collect = selector =>
      [...document.querySelectorAll(selector)].map(tag => tag.getAttribute('content'))
    return {
      title: document.title,
      twitterTitles: collect('meta[name="twitter:title"]'),
      twitterDescriptions: collect('meta[name="twitter:description"]'),
      twitterImages: collect('meta[name="twitter:image"]'),
      ogTitles: collect('meta[property="og:title"]'),
      allMetaNameCount: document.querySelectorAll('meta[name]').length,
    }
  })
  await context.close()
  return info
}

for (const base of [{ name: 'legacy', url: 'http://127.0.0.1:4174' }, { name: 'rebuild', url: 'http://127.0.0.1:4175' }]) {
  for (const mode of ['paused', 'fixed']) {
    console.log(base.name, mode, '/gallery =>', JSON.stringify(await probe(base.url, '/gallery', mode)))
  }
}
await browser.close()
