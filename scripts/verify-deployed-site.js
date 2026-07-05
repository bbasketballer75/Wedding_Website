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

async function fetchResponse(pathname) {
  const response = await fetch(`${normalizedSiteUrl}${pathname}`, { method: 'HEAD' })

  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`)
  }

  return response
}

function expectHeaderIncludes(headers, headerName, expectedFragment, label) {
  const value = headers.get(headerName)
  if (value?.includes(expectedFragment)) {
    addPass(`${label} ${headerName} includes ${expectedFragment}.`)
  } else {
    addFailure(
      `${label} ${headerName} should include ${expectedFragment}; got ${value || '<missing>'}.`
    )
  }
}

function expectHeaderMissingFragment(headers, headerName, forbiddenFragment, label) {
  const value = headers.get(headerName)
  if (value && !value.includes(forbiddenFragment)) {
    addPass(`${label} ${headerName} does not include ${forbiddenFragment}.`)
  } else {
    addFailure(
      `${label} ${headerName} should not include ${forbiddenFragment}; got ${value || '<missing>'}.`
    )
  }
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

  const assetPath = indexHtml.match(/href="(\/assets\/[^"]+\.css)"/)?.[1]
  if (assetPath) {
    const assetResponse = await fetchResponse(assetPath)
    expectHeaderIncludes(
      assetResponse.headers,
      'cache-control',
      'public,max-age=31536000,immutable',
      assetPath
    )
  } else {
    addFailure('Root HTML did not include a hashed CSS asset to verify cache headers.')
  }

  const indexResponse = await fetchResponse('/')
  expectHeaderIncludes(indexResponse.headers, 'cache-control', 'max-age=0', '/')
  expectHeaderIncludes(indexResponse.headers, 'content-security-policy', "default-src 'self'", '/')
  expectHeaderIncludes(
    indexResponse.headers,
    'content-security-policy-report-only',
    "default-src 'self'",
    '/'
  )
  expectHeaderMissingFragment(
    indexResponse.headers,
    'content-security-policy-report-only',
    "'unsafe-eval'",
    '/'
  )

  const manifestResponse = await fetchResponse('/manifest.webmanifest')
  expectHeaderIncludes(
    manifestResponse.headers,
    'content-type',
    'application/manifest+json',
    '/manifest.webmanifest'
  )
  expectHeaderIncludes(
    manifestResponse.headers,
    'cache-control',
    'no-cache,no-store,must-revalidate',
    '/manifest.webmanifest'
  )

  for (const path of ['/sw.js', '/robots.txt', '/sitemap.xml']) {
    const response = await fetchResponse(path)
    expectHeaderIncludes(
      response.headers,
      'cache-control',
      'no-cache,no-store,must-revalidate',
      path
    )
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
