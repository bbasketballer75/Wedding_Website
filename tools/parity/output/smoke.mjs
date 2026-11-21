import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const t0 = Date.now()
const browser = await chromium.launch({ headless: true })
console.log('browser version:', browser.version(), 'launch ms:', Date.now() - t0)
const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
console.log('clock api:', typeof page.clock?.setFixedTime, typeof page.clock?.install, typeof page.clock?.pauseAt)
// TS fixture import without extra deps (Node 26 native type stripping)
try {
  const mod = await import(pathToFileURL(path.resolve('tests/e2e/support/mockData.ts')).href)
  console.log('ts import ok, keys:', Object.keys(mod).join(','))
  console.log('galleryPhotos len:', mod.galleryPhotos.length)
} catch (error) {
  console.log('ts import FAILED:', error.message)
}
// screenshot of legacy
await page.clock.setFixedTime(new Date('2025-05-10T22:00:00Z'))
await ctx.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.origin === 'http://127.0.0.1:4174') return route.continue()
  return route.fulfill({ status: 204, body: '' })
})
await page.goto('http://127.0.0.1:4174/', { waitUntil: 'load', timeout: 30000 })
await page.waitForTimeout(1000)
console.log('title:', await page.title())
console.log('html theme:', await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.className].join(' | ')))
const shot = await page.screenshot({ fullPage: false })
console.log('shot bytes:', shot.length)
await browser.close()
