import { chromium } from 'playwright'
import { preparePage, installNetworkMocks, createMockState } from '../mocks/index.mjs'
import { loadFixtures } from '../mocks/fixtures.mjs'
import { loadMediaStub, adminSessionStorageKey } from '../mocks/index.mjs'

const fixtures = await loadFixtures({})
const mediaStub = await loadMediaStub()
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
})
const page = await context.newPage()
await preparePage(page, { theme: 'dark', mode: 'admin', fixtures: fixtures.data })
await installNetworkMocks(page, {
  baseUrl: 'http://127.0.0.1:4174',
  mode: 'admin',
  fixtures: fixtures.data,
  mediaStub,
  state: createMockState(),
})
const supa = new Set()
page.on('request', request => {
  const url = new URL(request.url())
  if (url.pathname.includes('/rest/') || url.pathname.includes('/rpc/') || url.pathname.includes('/auth/')) {
    supa.add(`${request.method()} ${url.pathname}${url.search}`)
  }
})
await page.clock.setFixedTime(new Date('2026-11-08T17:00:00Z'))
await page.goto('http://127.0.0.1:4174/admin/photos', { waitUntil: 'load', timeout: 30000 })
await page.waitForTimeout(4000)
const body = await page.evaluate(() => document.body.innerText)
console.log('--- supabase requests ---')
for (const line of [...supa].sort()) console.log(line)
console.log('--- body snippet ---')
console.log(body.replace(/\s+/g, ' ').slice(0, 600))
console.log('storageKey:', adminSessionStorageKey({ fixtures: fixtures.data }))
await browser.close()
