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
  image = '/images/og-default.jpg',
  type = 'website',
  twitterCard = 'summary_large_image',
  additionalMeta = {},
  structuredData,
  noIndex = false,
}: SEOHeadProps) {
  const siteName = "Austin & Jordyn's Wedding"
  const baseUrl = import.meta.env.VITE_SITE_URL || 'https://austinandjordyn.wedding'
  const fullTitle = `${title} | ${siteName}`
  const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`
  const fullCanonical = canonical ? `${baseUrl}${canonical}` : undefined

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
    if (structuredData) {
      let script = document.querySelector('script[type="application/ld+json"]')
      if (!script) {
        script = document.createElement('script')
        script.setAttribute('type', 'application/ld+json')
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(structuredData)
    }

    // Cleanup on unmount
    return () => {
      // Note: We don't remove meta tags on unmount to prevent flickering
      // between route changes. The next SEOHead will update them.
    }
  }, [fullTitle, description, fullImageUrl, fullCanonical, type, twitterCard, additionalMeta, structuredData, noIndex, siteName])

  return null
}

// Pre-configured SEO for common pages
export function HomeSEO() {
  return (
    <SEOHead
      title="Home"
      description="Join us in celebrating the wedding of Austin and Jordyn. View our story, photos, and share your memories."
      image="/images/og-home.jpg"
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: "Austin & Jordyn's Wedding",
        url: import.meta.env.VITE_SITE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: '{search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  )
}

export function GallerySEO() {
  return (
    <SEOHead
      title="Photo Gallery"
      description="Browse our wedding photos and share your own. A collection of memories from our special day."
      image="/images/og-gallery.jpg"
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: 'Wedding Photo Gallery',
        description: 'A collection of wedding photos',
      }}
    />
  )
}

export function GuestbookSEO() {
  return (
    <SEOHead
      title="Guestbook"
      description="Leave a message for Austin and Jordyn. Share your favorite memories from our wedding day."
      image="/images/og-guestbook.jpg"
    />
  )
}

export default SEOHead
