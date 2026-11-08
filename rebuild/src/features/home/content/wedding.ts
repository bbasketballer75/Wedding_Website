/**
 * Structured Home content constants.
 *
 * Source of truth: `contracts/content/wedding.json` (extracted from the frozen
 * `src/config/weddingConfig.ts` + the Home hero poster constant). The rebuild
 * cannot import the contract JSON across the Vite root boundary, so the values
 * are mirrored here with their provenance. `contracts/` remains authoritative —
 * if it changes, this file must be updated in the same PR.
 */
export const SITE_TITLE = "Austin & Jordyn's Wedding"

export const COUPLE = {
  person1: { name: 'Austin', initial: 'A' },
  person2: { name: 'Jordyn', initial: 'J' },
} as const

/** Frozen `WEDDING_DATE` (`src/config/weddingConfig.ts:1`). */
export const WEDDING_DATE = new Date('2025-05-10T17:00:00-05:00')

/** Frozen `HERO_POSTER` (`src/pages/Home.tsx:23`). */
export const HERO_POSTER = '/images/home/intro-video-poster.png'

/** Frozen Home SEO copy (`src/components/seo/SEOHead.tsx`, `HomeSEO`). */
export const HOME_SEO = {
  title: 'Home',
  description:
    'Join us in celebrating the wedding of Austin and Jordyn. View our story, photos, and share your memories.',
  canonical: '/',
  image: '/images/home/intro-video-poster.png',
} as const
