import { writeFileSync } from 'fs'
import dotenv from 'dotenv'
import { SitemapStream, streamToPromise } from 'sitemap'
import { Readable } from 'stream'

dotenv.config()

const DOMAIN = (process.env.VITE_SITE_URL || 'https://www.theporadas.com').replace(/\/+$/, '')

// Static routes
const routes = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/film', changefreq: 'monthly', priority: 0.9 },
  { url: '/gallery', changefreq: 'monthly', priority: 0.8 },
  { url: '/guestbook', changefreq: 'weekly', priority: 0.8 },
  { url: '/upload', changefreq: 'weekly', priority: 0.7 },
]

// Generate sitemap
async function generateSitemap() {
  const sitemap = new SitemapStream({ hostname: DOMAIN })
  const links = routes.map(route => ({
    url: route.url,
    changefreq: route.changefreq,
    priority: route.priority,
    lastmod: new Date().toISOString(),
  }))

  // Write links to sitemap
  const stream = Readable.from(links)
  stream.pipe(sitemap)

  const xml = await streamToPromise(sitemap)

  // Write to public directory
  writeFileSync('./dist/sitemap.xml', xml.toString())
  console.log('✅ Sitemap generated successfully!')
}

// Generate robots.txt
function generateRobots() {
  const robots = `User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml`

  writeFileSync('./dist/robots.txt', robots)
  console.log('✅ Robots.txt generated successfully!')
}

// Run generators
generateSitemap().catch(console.error)
generateRobots()
