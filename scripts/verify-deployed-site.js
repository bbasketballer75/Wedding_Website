import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const siteUrl = process.env.VITE_SITE_URL?.trim()
const failures = []

function addFailure(message) {
  failures.push(message)
  console.error(`FAIL: ${message}`)
}

function addPass(message) {
  console.log(`OK: ${message}`)
}

if (!siteUrl) {
  console.error('VITE_SITE_URL is required to verify the deployed site.')
  process.exit(1)
}

const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')

async function fetchText(pathname) {
  const response = await fetch(`${normalizedSiteUrl}${pathname}`)

  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`)
  }

  return response.text()
}

async function main() {
  console.log(`Verifying deployed site at ${normalizedSiteUrl}`)

  const [indexHtml, robotsTxt, sitemapXml] = await Promise.all([
    fetchText('/'),
    fetchText('/robots.txt'),
    fetchText('/sitemap.xml'),
  ])

  const adminLoginResponse = await fetch(`${normalizedSiteUrl}/admin/login`)
  if (adminLoginResponse.ok) {
    addPass('/admin/login responds successfully.')
  } else {
    addFailure(`/admin/login returned HTTP ${adminLoginResponse.status}.`)
  }

  const expectedRootUrl = `${normalizedSiteUrl}/`
  const rootChecks = [
    `property="og:url" content="${expectedRootUrl}"`,
    `property="twitter:url" content="${expectedRootUrl}"`,
    `property="og:image" content="${expectedRootUrl}images/og-image.webp"`,
    `property="twitter:image" content="${expectedRootUrl}images/og-image.webp"`,
    `rel="canonical" href="${expectedRootUrl}"`,
  ]

  for (const fragment of rootChecks) {
    if (indexHtml.includes(fragment)) {
      addPass(`Root HTML contains ${fragment}.`)
    } else {
      addFailure(`Root HTML is missing ${fragment}.`)
    }
  }

  if (indexHtml.includes('austinandjordyn.com')) {
    addFailure('Root HTML still references the retired austinandjordyn.com domain.')
  } else {
    addPass('Root HTML does not reference the retired austinandjordyn.com domain.')
  }

  const expectedSitemapLine = `Sitemap: ${normalizedSiteUrl}/sitemap.xml`
  if (robotsTxt.includes(expectedSitemapLine)) {
    addPass('robots.txt points to the expected sitemap.')
  } else {
    addFailure(`robots.txt should include ${expectedSitemapLine}.`)
  }

  for (const route of ['/', '/film', '/gallery', '/guestbook', '/upload']) {
    const expectedLoc = `<loc>${normalizedSiteUrl}${route}</loc>`
    if (sitemapXml.includes(expectedLoc)) {
      addPass(`sitemap.xml includes ${route}.`)
    } else {
      addFailure(`sitemap.xml is missing ${route}.`)
    }
  }

  if (failures.length > 0) {
    console.error(`Deployed site verification failed with ${failures.length} issue(s).`)
    process.exit(1)
  }

  console.log('Deployed site verification passed.')
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
