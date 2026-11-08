/**
 * Film-page JSON-LD, matching the frozen `FilmSEO` structured data
 * (`src/components/seo/SEOHead.tsx`): one `VideoObject` script tagged
 * `data-seo-structured-data="true"`.
 *
 * The shared `usePageMeta` hook only owns the classic meta tags today, so the
 * film feature emits its own JSON-LD to keep the frozen SEO contract intact.
 * W8 (metadata layer) should absorb this into `app/seo` and delete this module.
 */
import { useEffect } from 'react'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.theporadas.com').replace(/\/+$/, '')
const THUMBNAIL_URL = `${SITE_URL}/images/film/main-film-poster.png`

export function createFilmStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: "Austin & Jordyn's Wedding Film",
    description: 'A feature-length wedding film covering the ceremony, speeches, and celebration.',
    thumbnailUrl: THUMBNAIL_URL,
    uploadDate: '2025-05-10',
    embedUrl: `${SITE_URL}/film`,
  }
}

export function useFilmStructuredData(): void {
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-seo-structured-data', 'true')
    script.textContent = JSON.stringify(createFilmStructuredData())
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])
}
