import { expect, gotoPublicPage, test } from './support/publicSite'

const seoExpectations = [
  { route: '/', title: 'Home', canonicalSuffix: '/', robots: 'index, follow' },
  { route: '/film', title: 'Wedding Film', canonicalSuffix: '/film', robots: 'index, follow' },
  { route: '/gallery', title: 'Photo Gallery', canonicalSuffix: '/gallery', robots: 'index, follow' },
  { route: '/guestbook', title: 'Guestbook', canonicalSuffix: '/guestbook', robots: 'index, follow' },
  { route: '/upload', title: 'Share Memories', canonicalSuffix: '/upload', robots: 'index, follow' },
  { route: '/people', title: 'People', canonicalSuffix: '/people', robots: 'index, follow' },
  { route: '/guest-photos', title: 'Guest Memories', canonicalSuffix: '/guest-photos', robots: 'index, follow' },
] as const

test.describe('SEO Metadata', () => {
  for (const expectation of seoExpectations) {
    test(`applies metadata for ${expectation.route}`, async ({ page }) => {
      await gotoPublicPage(page, expectation.route)

      await expect(page).toHaveTitle(new RegExp(`^${expectation.title} \\| Austin & Jordyn's Wedding$`))

      const description = page.locator('meta[name="description"]')
      await expect(description).toHaveAttribute('content', /.+/)

      const robots = page.locator('meta[name="robots"]')
      await expect(robots).toHaveAttribute('content', expectation.robots)

      const canonical = page.locator('link[rel="canonical"]')
      await expect(canonical).toHaveAttribute('href', new RegExp(`${expectation.canonicalSuffix.replace('/', '\\/')}$`))

      const ogTitle = page.locator('meta[property="og:title"]')
      await expect(ogTitle).toHaveAttribute('content', new RegExp(`^${expectation.title} \\| Austin & Jordyn's Wedding$`))

      const ogImage = page.locator('meta[property="og:image"]')
      await expect(ogImage).toHaveAttribute('content', /^https?:\/\/.+/)

      const structuredData = page.locator('script[data-seo-structured-data="true"]')
      await expect(structuredData).toHaveCount(1)
    })
  }

  test('marks the 404 page as noindex', async ({ page }) => {
    await gotoPublicPage(page, '/this-page-does-not-exist')

    await expect(page).toHaveTitle(/Page Not Found \| Austin & Jordyn's Wedding/)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/404$/)
  })
})
