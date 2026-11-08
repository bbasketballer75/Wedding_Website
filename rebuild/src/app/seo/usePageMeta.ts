import { useEffect } from 'react'

/**
 * Per-route document metadata, matching the frozen app's SEOHead contract
 * (title template, robots wording, canonical and social tags) so text parity is
 * possible on shell routes. Wave 8 replaces this with the full metadata layer.
 */
const SITE_NAME = "Austin & Jordyn's Wedding"
const DEFAULT_SITE_URL = 'https://www.theporadas.com'
const DEFAULT_SOCIAL_IMAGE = '/images/home/intro-video-poster.png'

function upsertMeta(name: string, content: string, property = false): void {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
  let meta = document.querySelector<HTMLMetaElement>(selector)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute(property ? 'property' : 'name', name)
    document.head.appendChild(meta)
  }
  meta.content = content
}

export interface PageMeta {
  title: string
  description: string
  canonical?: string
  image?: string
  noIndex?: boolean
}

export function usePageMeta({
  title,
  description,
  canonical,
  image = DEFAULT_SOCIAL_IMAGE,
  noIndex = false,
}: PageMeta): void {
  const baseUrl = (import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
  const fullTitle = `${title} | ${SITE_NAME}`
  const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`
  const fullCanonical = canonical
    ? canonical.startsWith('http')
      ? canonical
      : `${baseUrl}${canonical}`
    : undefined

  useEffect(() => {
    document.title = fullTitle
    upsertMeta('description', description)
    upsertMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('og:title', fullTitle, true)
    upsertMeta('og:description', description, true)
    upsertMeta('og:type', 'website', true)
    upsertMeta('og:url', fullCanonical ?? window.location.href, true)
    upsertMeta('og:image', fullImageUrl, true)
    upsertMeta('og:image:width', '1200', true)
    upsertMeta('og:image:height', '630', true)
    upsertMeta('og:site_name', SITE_NAME, true)
    upsertMeta('og:locale', 'en_US', true)
    upsertMeta('twitter:card', 'summary_large_image')
    upsertMeta('twitter:title', fullTitle)
    upsertMeta('twitter:description', description)
    upsertMeta('twitter:image', fullImageUrl)

    if (fullCanonical) {
      let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!canonicalLink) {
        canonicalLink = document.createElement('link')
        canonicalLink.rel = 'canonical'
        document.head.appendChild(canonicalLink)
      }
      canonicalLink.href = fullCanonical
    }
  }, [description, fullCanonical, fullImageUrl, fullTitle, noIndex])
}
