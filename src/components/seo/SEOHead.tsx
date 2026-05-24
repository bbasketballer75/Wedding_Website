import { useEffect } from 'react'

interface SEOHeadProps {
  title: string
  description: string
  /** Canonical URL */
  canonical?: string
  /** Open Graph image URL */
  image?: string
  /** Open Graph type */
  type?: 'website' | 'article' | 'profile'
  /** Twitter card type */
  twitterCard?: 'summary' | 'summary_large_image'
  /** Additional meta tags */
  additionalMeta?: Record<string, string>
  /** JSON-LD structured data */
  structuredData?: Record<string, unknown>
  /** No index this page */
  noIndex?: boolean
}

const SITE_NAME = "Austin & Jordyn's Wedding"
const SITE_URL = 'https://www.theporadas.com'
const DEFAULT_SOCIAL_IMAGE = '/images/home/intro-video-poster.png'
const FILM_SOCIAL_IMAGE = '/images/film/main-film-poster.png'
const EVENT_DETAILS = {
  date: '2025-05-10T15:30:00-04:00',
  location: {
    name: 'The Lodge at Indian Lake',
    address: 'The Lodge at Indian Lake',
  },
  couple: {
    partner1: 'Austin Porada',
    partner2: 'Jordyn Porada',
  },
} as const

/**
 * SEOHead - Comprehensive SEO meta tags
 *
 * Features:
 * - Title and meta description
 * - Open Graph tags (Facebook, LinkedIn)
 * - Twitter Card tags
 * - Canonical URL
 * - JSON-LD structured data
 * - Robots meta
 */
export function SEOHead({
  title,
  description,
  canonical,
  image = DEFAULT_SOCIAL_IMAGE,
  type = 'website',
  twitterCard = 'summary_large_image',
  additionalMeta = {},
  structuredData,
  noIndex = false,
}: SEOHeadProps) {
  const siteName = SITE_NAME
  const baseUrl = import.meta.env.VITE_SITE_URL || SITE_URL
  const fullTitle = `${title} | ${siteName}`
  const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`
  const fullCanonical = canonical
    ? canonical.startsWith('http')
      ? canonical
      : `${baseUrl}${canonical}`
    : undefined

  useEffect(() => {
    // Update document title
    document.title = fullTitle

    // Helper to update or create meta tag
    const updateMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let meta = document.querySelector(selector) as HTMLMetaElement

      if (!meta) {
        meta = document.createElement('meta')
        if (property) {
          meta.setAttribute('property', name)
        } else {
          meta.setAttribute('name', name)
        }
        document.head.appendChild(meta)
      }

      meta.content = content
    }

    // Standard meta tags
    updateMeta('description', description)
    updateMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    // Open Graph tags
    updateMeta('og:title', fullTitle, true)
    updateMeta('og:description', description, true)
    updateMeta('og:type', type, true)
    updateMeta('og:url', fullCanonical || window.location.href, true)
    updateMeta('og:image', fullImageUrl, true)
    updateMeta('og:image:width', '1200', true)
    updateMeta('og:image:height', '630', true)
    updateMeta('og:site_name', siteName, true)
    updateMeta('og:locale', 'en_US', true)

    // Twitter Card tags
    updateMeta('twitter:card', twitterCard)
    updateMeta('twitter:title', fullTitle)
    updateMeta('twitter:description', description)
    updateMeta('twitter:image', fullImageUrl)

    // Additional meta tags
    Object.entries(additionalMeta).forEach(([name, content]) => {
      updateMeta(name, content)
    })

    // Canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (fullCanonical) {
      if (!canonicalLink) {
        canonicalLink = document.createElement('link')
        canonicalLink.rel = 'canonical'
        document.head.appendChild(canonicalLink)
      }
      canonicalLink.href = fullCanonical
    } else if (canonicalLink) {
      canonicalLink.remove()
    }

    // JSON-LD structured data
    let script = document.querySelector('script[data-seo-structured-data="true"]')
    if (structuredData) {
      if (!script) {
        script = document.createElement('script')
        script.setAttribute('type', 'application/ld+json')
        script.setAttribute('data-seo-structured-data', 'true')
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(structuredData)
    } else if (script) {
      script.remove()
    }

    // Cleanup on unmount
    return () => {
      // Note: We don't remove meta tags on unmount to prevent flickering
      // between route changes. The next SEOHead will update them.
    }
  }, [
    fullTitle,
    description,
    fullImageUrl,
    fullCanonical,
    type,
    twitterCard,
    additionalMeta,
    structuredData,
    noIndex,
    siteName,
  ])

  return null
}

// Pre-configured SEO for common pages
export function HomeSEO() {
  return (
    <SEOHead
      title='Home'
      description='Join us in celebrating the wedding of Austin and Jordyn. View our story, photos, and share your memories.'
      canonical='/'
      image={DEFAULT_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: SITE_NAME,
            url: import.meta.env.VITE_SITE_URL || SITE_URL,
          },
          {
            '@type': 'Event',
            name: SITE_NAME,
            description:
              'Relive the ceremony, portraits, guestbook, and shared memories from Austin and Jordyn’s wedding day.',
            startDate: EVENT_DETAILS.date,
            eventStatus: 'https://schema.org/EventCompleted',
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            image: `${import.meta.env.VITE_SITE_URL || SITE_URL}${DEFAULT_SOCIAL_IMAGE}`,
            location: {
              '@type': 'Place',
              name: EVENT_DETAILS.location.name,
              address: {
                '@type': 'PostalAddress',
                streetAddress: EVENT_DETAILS.location.address,
              },
            },
            organizer: {
              '@type': 'Organization',
              name: SITE_NAME,
            },
            performer: [
              { '@type': 'Person', name: EVENT_DETAILS.couple.partner1 },
              { '@type': 'Person', name: EVENT_DETAILS.couple.partner2 },
            ],
          },
        ],
      }}
    />
  )
}

export function FilmSEO() {
  return (
    <SEOHead
      title='Wedding Film'
      description='Watch the full wedding film for Austin and Jordyn, from getting ready through the last dance.'
      canonical='/film'
      image={FILM_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: "Austin & Jordyn's Wedding Film",
        description:
          'A feature-length wedding film covering the ceremony, speeches, and celebration.',
        thumbnailUrl: `${import.meta.env.VITE_SITE_URL || SITE_URL}${FILM_SOCIAL_IMAGE}`,
        uploadDate: '2025-05-10',
        embedUrl: `${import.meta.env.VITE_SITE_URL || SITE_URL}/film`,
      }}
    />
  )
}

export function GallerySEO({ shareImage }: { shareImage?: string }) {
  return (
    <SEOHead
      title={shareImage ? 'Shared Wedding Photos' : 'Photo Gallery'}
      description={
        shareImage
          ? "Check out these wedding photos from Austin & Jordyn's special day."
          : 'Browse our wedding photos and share your own. A collection of memories from our special day.'
      }
      canonical='/gallery'
      image={shareImage ?? DEFAULT_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: 'Wedding Photo Gallery',
        description:
          'A collection of wedding portraits, candids, and guest photos from Austin and Jordyn’s wedding.',
      }}
    />
  )
}

export function GuestbookSEO() {
  return (
    <SEOHead
      title='Guestbook'
      description='Leave a message for Austin and Jordyn. Share your favorite memories from our wedding day.'
      canonical='/guestbook'
      image={DEFAULT_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: "Austin & Jordyn's Guestbook",
        description: 'Messages and replies from family and friends.',
      }}
    />
  )
}

export function UploadSEO() {
  return (
    <SEOHead
      title='Share Memories'
      description='Share the wedding site, upload your photos and videos, and help Austin and Jordyn keep the day alive from every angle.'
      canonical='/upload'
      image={DEFAULT_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Share Wedding Memories',
        description:
          'A guest sharing page for sending photos, videos, and the wedding site itself to loved ones.',
      }}
    />
  )
}

export function PeopleSEO() {
  return (
    <SEOHead
      title='People'
      description='Browse photos by person. See who appeared in the engagement session, wedding day, and guest uploads.'
      canonical='/people'
      image={DEFAULT_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'People in the Photos',
        description: 'A face-tagged index of everyone who appears in the wedding photo collection.',
      }}
    />
  )
}

export function NotFoundSEO() {
  return (
    <SEOHead
      title='Page Not Found'
      description='This page could not be found.'
      canonical='/404'
      image={DEFAULT_SOCIAL_IMAGE}
      noIndex
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '404 Page Not Found',
        description: 'A missing page on the Austin and Jordyn wedding website.',
      }}
    />
  )
}

export function PrintSEO() {
  return (
    <SEOHead
      title='Memory Book'
      description="Print a photo book or guestbook keepsake from Austin & Jordyn's wedding archive."
      canonical='/print'
      image={DEFAULT_SOCIAL_IMAGE}
      noIndex
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Memory Book — Print & Export',
        description: 'A print-ready photo book and guestbook keepsake from the wedding archive.',
      }}
    />
  )
}

export default SEOHead
