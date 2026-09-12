/**
 * Gallery constants — pure data module extracted from src/pages/Gallery.tsx.
 *
 * Why this exists
 * ---------------
 * `src/pages/Gallery.tsx` was a 2143-line monolith. These values are the
 * dependency-free pieces that every other gallery module needs (types, lookups,
 * session helpers, cover images). Keeping them here means:
 *
 *   1. The page component can shrink to a thin composition layer.
 *   2. The new hooks and subcomponents can import them without pulling in
 *      Supabase / Framer Motion / the router.
 *   3. Tests can target the helpers directly.
 *
 * Nothing in this file has React or browser-only globals — `getPhotoEngagementSessionId`
 * is the one exception and it already guards `typeof window === 'undefined'`.
 */

import { getMediaPath } from '@/utils/media'
import type { Photo } from '@/lib/supabase'

import { partyData } from '@/data/weddingParty'

// ─── Collection tab type & metadata ────────────────────────────────────────

export type CollectionTab = 'Proposal' | 'Bach+ette' | 'Wedding Photos' | 'Guest Photos'
// ─── Photo type ──────────────────────────────────────────────────────────────
// Extended photo type for gallery display.
// Makes is_professional and created_at optional so static curated photos don't need them.
export interface GalleryPhoto extends Omit<Photo, 'is_professional' | 'created_at'> {
  is_professional?: boolean
  created_at?: string
  downloadUrl?: string
  albumSortOrder?: number
  aspectRatio: number
  createdAt?: string
  source: 'professional' | 'guest'
  collection: CollectionTab
}

export const collectionTabs: CollectionTab[] = [
  'Proposal',
  'Bach+ette',
  'Wedding Photos',
  'Guest Photos',
]

export const collectionMeta: Record<
  CollectionTab,
  {
    eyebrow: string
    title: string
    description: string
    supporting: string
    sourceHint: string
  }
> = {
  Proposal: {
    eyebrow: 'Before the wedding',
    title: 'Proposal and engagement portraits',
    description: 'The proposal, portraits, and the whole season before the wedding day.',
    supporting: 'Everything from the engagement chapter lives here.',
    sourceHint: 'Proposal album',
  },
  'Bach+ette': {
    eyebrow: 'Pre-wedding weekends',
    title: 'Bachelor and bachelorette memories',
    description: 'The full pre-wedding weekend album.',
    supporting: 'Everything from the bachelor and bachelorette events lives here.',
    sourceHint: 'Bach+ette album',
  },
  'Wedding Photos': {
    eyebrow: 'The day itself',
    title: 'Wedding day coverage',
    description: 'The photographer-led archive for the day itself.',
    supporting: 'This is the main album for ceremony, portraits, and reception coverage.',
    sourceHint: 'Wedding-day album',
  },
  'Guest Photos': {
    eyebrow: 'From family and friends',
    title: 'Guest Perspectives',
    description: 'A collection of memories and angles shared by our loved ones.',
    supporting: 'This stays separate from the photographer coverage on purpose.',
    sourceHint: 'Guest album',
  },
}

export const COLLECTION_COVERS: Record<CollectionTab, string> = {
  Proposal: '/images/engagement/PoradaProposal-29.webp',
  'Bach+ette': getMediaPath('/media/_thumbs/Bach+ette/Photos/PXL_20240816_221115487.MP.webp'),
  'Wedding Photos': getMediaPath('/media/_thumbs/Professional/Wedding Day/Photos/DSC06261.webp'),
  'Guest Photos': getMediaPath(
    '/media/_thumbs/Guest Uploads/Wedding Day/Live Photos/Stills/20250511_180812-0b9c.webp'
  ),
}

// ─── Face-name aliases ─────────────────────────────────────────────────────
// Maps first-name-only face tags to full names so "Austin" and "Austin Porada"
// are treated as the same person in filters and the detected-faces widget.

export const FACE_NAME_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const person of [
    ...partyData.couple,
    ...partyData.parents,
    ...partyData.groomsmen,
    ...partyData.bridesmaids,
  ]) {
    if (person.name && person.fullName && person.name !== person.fullName) {
      map[person.name] = person.fullName
    }
  }
  return map
})()

export function resolveAlias(name: string): string {
  return FACE_NAME_ALIASES[name] ?? name
}

// ─── Engagement session + comment author storage keys ──────────────────────

export const PHOTO_ENGAGEMENT_SESSION_KEY = 'wedding-gallery-engagement-session'
export const PHOTO_COMMENT_AUTHOR_KEY = 'wedding-gallery-comment-author'

/**
 * Returns a stable per-browser session id used to attribute anonymous likes
 * and comments. Persists the generated id in localStorage so the same browser
 * keeps the same identity across reloads.
 */
export const getPhotoEngagementSessionId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-preview-session'
  }

  const existingSessionId = window.localStorage.getItem(PHOTO_ENGAGEMENT_SESSION_KEY)
  if (existingSessionId) {
    return existingSessionId
  }

  const generatedSessionId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  window.localStorage.setItem(PHOTO_ENGAGEMENT_SESSION_KEY, generatedSessionId)
  return generatedSessionId
}
