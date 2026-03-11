import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config()

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')
const failures = []
const warnings = []

function addFailure(message) {
  failures.push(message)
  console.error(`FAIL: ${message}`)
}

function addWarning(message) {
  warnings.push(message)
  console.warn(`WARN: ${message}`)
}

function addPass(message) {
  console.log(`OK: ${message}`)
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    addFailure(`${name} is required for launch readiness.`)
    return null
  }

  addPass(`${name} is configured.`)
  return value
}

function readDistFile(name) {
  const filePath = path.join(distDir, name)
  if (!fs.existsSync(filePath)) {
    addFailure(`${name} is missing from dist. Run \`npm run build\` first.`)
    return null
  }

  return fs.readFileSync(filePath, 'utf8')
}

console.log('Checking launch-specific readiness...')

const siteUrl = requireEnv('VITE_SITE_URL')
requireEnv('VITE_GA_ID')
requireEnv('VITE_SENTRY_DSN')

if (!process.env.VITE_APP_VERSION?.trim()) {
  addWarning('VITE_APP_VERSION is not set. Launch is safer with an explicit release label for Sentry and deployment notes.')
} else {
  addPass('VITE_APP_VERSION is configured.')
}

const normalizedSiteUrl = siteUrl?.replace(/\/+$/, '') ?? null

const indexHtml = readDistFile('index.html')
const robotsTxt = readDistFile('robots.txt')
const sitemapXml = readDistFile('sitemap.xml')

if (indexHtml && normalizedSiteUrl) {
  const expectedRootUrl = `${normalizedSiteUrl}/`
  const requiredStrings = [
    `property="og:url" content="${expectedRootUrl}"`,
    `property="twitter:url" content="${expectedRootUrl}"`,
    `property="og:image" content="${expectedRootUrl}images/og-image.webp"`,
    `property="twitter:image" content="${expectedRootUrl}images/og-image.webp"`,
    `rel="canonical" href="${expectedRootUrl}"`,
  ]

  for (const requiredString of requiredStrings) {
    if (indexHtml.includes(requiredString)) {
      addPass(`dist/index.html contains ${requiredString}.`)
    } else {
      addFailure(`dist/index.html is missing ${requiredString}.`)
    }
  }

  if (indexHtml.includes('austinandjordyn.com')) {
    addFailure('dist/index.html still references the retired austinandjordyn.com domain.')
  } else {
    addPass('dist/index.html does not reference the retired austinandjordyn.com domain.')
  }
}

if (robotsTxt && normalizedSiteUrl) {
  const expectedSitemap = `Sitemap: ${normalizedSiteUrl}/sitemap.xml`
  if (robotsTxt.includes(expectedSitemap)) {
    addPass('dist/robots.txt references the expected sitemap URL.')
  } else {
    addFailure(`dist/robots.txt should include ${expectedSitemap}.`)
  }
}

if (sitemapXml && normalizedSiteUrl) {
  const requiredRoutes = ['/', '/film', '/gallery', '/guestbook', '/upload']
  for (const route of requiredRoutes) {
    const expectedLoc = `<loc>${normalizedSiteUrl}${route}</loc>`
    if (sitemapXml.includes(expectedLoc)) {
      addPass(`dist/sitemap.xml includes ${route}.`)
    } else {
      addFailure(`dist/sitemap.xml is missing ${route}.`)
    }
  }
}

if (failures.length > 0) {
  console.error(`Launch readiness verification failed with ${failures.length} issue(s).`)
  process.exit(1)
}

console.log('Launch readiness verification passed.')
if (warnings.length > 0) {
  console.log(`Completed with ${warnings.length} warning(s).`)
}
