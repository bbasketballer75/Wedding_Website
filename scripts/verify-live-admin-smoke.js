import dotenv from 'dotenv'
import { chromium } from '@playwright/test'

dotenv.config({ quiet: true })

const siteUrl = (process.env.VITE_SITE_URL || 'https://www.theporadas.com').replace(/\/+$/, '')
const email = process.env.ADMIN_SMOKE_EMAIL?.trim()
const password = process.env.ADMIN_SMOKE_PASSWORD?.trim()

if (!email || !password) {
  console.log(
    'Live admin smoke skipped. Set ADMIN_SMOKE_EMAIL and ADMIN_SMOKE_PASSWORD in an ignored local env file to enable it.'
  )
  process.exit(0)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

try {
  await page.goto(`${siteUrl}/admin/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#admin-login-email').fill(email)
  await page.locator('#admin-login-password').fill(password)
  await page.getByTestId('admin-login-submit').click()
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})

  const adminHeader = page.getByTestId('admin-header')
  await adminHeader.waitFor({ state: 'visible', timeout: 20000 })

  if (!page.url().includes('/admin')) {
    throw new Error(`Expected to land in /admin, got ${page.url()}`)
  }

  await page.getByTestId('admin-signout').waitFor({ state: 'visible', timeout: 10000 })
  console.log('Live admin smoke passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await browser.close()
}
