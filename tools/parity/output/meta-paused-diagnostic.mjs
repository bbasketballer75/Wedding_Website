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
  await page.clock.install({ time: new Date('2026-11-08T17:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-08T17:00:00Z').getTime() + 1)
  await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 30000 })
  await page.clock.runFor(1200)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  // wait for main content like capture.mjs does
  for (let i = 0; i < 100; i += 1) {
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
  const samples = []
  for (let i = 0; i < 20; i += 1) {
    const title = await page.evaluate(() => document.title)
    samples.push(`${i * 300}ms:${title}`)
    if (title !== 'Austin & Jordyn | Wedding Archive') break
    await page.clock.runFor(300)
    await page.waitForTimeout(20)
  }
  const final = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content ?? null,
    twitter: document.querySelector('meta[name="twitter:title"]')?.content ?? null,
  }))
  await context.close()
  return { samples, final }
}

console.log('legacy /gallery:', JSON.stringify(await probe('http://127.0.0.1:4174', '/gallery'), null, 1))
await browser.close()
