import { getAbsoluteMediaUrl, getAbsoluteUrl } from '@/utils/media'

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://austinandjordyn.com'

// Wedding event structured data
export const weddingEventData = {
  '@context': 'https://schema.org',
  '@type': 'Wedding',
  name: "Austin & Jordyn's Wedding",
  description: 'We celebrated our wedding at The Lodge at Indian Lake',
  startDate: '2025-05-10T16:00:00-04:00',
  endDate: '2025-05-10T23:00:00-04:00',
  location: {
    '@type': 'Place',
    name: 'The Lodge at Indian Lake',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '12645 S County Rd 225 W',
      addressLocality: 'Russells Point',
      addressRegion: 'OH',
      postalCode: '43348',
      addressCountry: 'US',
    },
  },
  organizer: {
    '@type': 'Person',
    name: 'Austin Baskerville',
    url: SITE_URL,
  },
  image: [
    getAbsoluteUrl('/images/engagement/PoradaProposal-29.webp'),
    getAbsoluteUrl('/images/gallery/hero.webp'),
  ],
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
}

// Person structured data
export const personData = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Austin Baskerville',
  url: SITE_URL,
  sameAs: [
    'https://www.instagram.com/austin.baskerville',
    'https://www.linkedin.com/in/austin-baskerville',
  ],
  spouse: {
    '@type': 'Person',
    name: 'Jordyn Porada',
  },
}

// Website structured data
export const websiteData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: "Austin & Jordyn's Wedding",
  url: SITE_URL,
  description:
    "Relive the beautiful memories from Austin & Jordyn's wedding at The Lodge at Indian Lake",
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

// Image gallery structured data
export const imageGalleryData = images => ({
  '@context': 'https://schema.org',
  '@type': 'ImageGallery',
  name: 'Wedding Photo Gallery',
  description: "Photos from Austin & Jordyn's wedding celebration",
  url: `${SITE_URL}/gallery`,
  image: images.map(img => ({
    '@type': 'ImageObject',
    url: img.startsWith('http') ? img : getAbsoluteUrl(img),
    caption: img.alt || 'Wedding photo',
  })),
})

// Video structured data
export const videoData = () => ({
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: "Austin & Jordyn's Wedding Video",
  description: 'Watch the highlights from our wedding day',
  thumbnailUrl: getAbsoluteUrl('/images/video-thumbnail.webp'),
  uploadDate: '2024-10-15',
  duration: 'PT40M30S',
  contentUrl: getAbsoluteMediaUrl('/video/main.mp4'),
  embedUrl: `${SITE_URL}/film`,
})
