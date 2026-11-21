import { chromium } from 'playwright'
import { preparePage, installNetworkMocks, createMockState } from '../mocks/index.mjs'
import { loadFixtures } from '../mocks/fixtures.mjs'
import { loadMediaStub } from '../mocks/index.mjs'

const fixtures = await loadFixtures({})
const mediaStub = await loadMediaStub()
const browser = await chromium.launch({ headless: true })

async function probe(baseUrl, path) {
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
  await page.clock.setFixedTime(new Date('2026-11-08T17:00:00Z'))
  await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content ?? null,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
  }))
  await context.close()
  return info
}

for (const path of ['/', '/gallery', '/film', '/upload']) {
  console.log('legacy real-timers', path, '=>', JSON.stringify(await probe('http://127.0.0.1:4174', path)))
  console.log('rebuild real-timers', path, '=>', JSON.stringify(await probe('http://127.0.0.1:4175', path)))
}
await browser.close()
