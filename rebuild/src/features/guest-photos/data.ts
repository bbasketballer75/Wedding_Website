/**
 * Guest Photos data boundary (Wave 6 W6-3).
 *
 * Deterministic stub + hook so the page renders/tests parity before the typed
 * data layer is wired.
 *
 * TODO(Wave3): the Lead swaps `createStubGuestPhotosApi` for a thin adapter over
 * `shared/data/guestUploads.ts`; the `GuestPhotosApi` interface is a 1:1 mirror
 * of the frozen `fetchApprovedGuestUploads()` (`src/lib/supabase/guestUploads.ts`):
 *
 *   loadApprovedUploads -> fetchApprovedGuestUploads().map(row => ({
 *     id: row.id,
 *     guestName: row.guest_name,
 *     message: row.message,
 *     photoUrls: row.photoUrls,          // normalised by shared/data
 *     status: row.status,
 *     createdAt: row.created_at ?? '',
 *   }))
 *
 * No component changes are needed for that swap.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FEATURED_PHOTO_LIMIT,
  GUEST_PHOTOS_COPY,
  UPLOAD_DATE_LOCALE,
  UPLOAD_DATE_OPTIONS,
} from './constants'
import { createGuestPhotosFixture } from './fixtures'
import type {
  FeaturedGuestPhoto,
  GuestPhotoUpload,
  GuestPhotosApi,
  GuestPhotosStats,
} from './types'

/* -------------------------------------------------------------------------- */
/* Pure helpers (frozen page logic)                                            */
/* -------------------------------------------------------------------------- */

/** Approved-only filter (defensive: the frozen API already filters server-side). */
export function filterApprovedUploads(uploads: readonly GuestPhotoUpload[]): GuestPhotoUpload[] {
  return uploads.filter(upload => upload.status === 'approved')
}

/** Frozen `photoCount` + upload count stats. */
export function computeGuestPhotosStats(uploads: readonly GuestPhotoUpload[]): GuestPhotosStats {
  return {
    approvedUploads: uploads.length,
    guestPhotos: uploads.reduce((total, upload) => total + upload.photoUrls.length, 0),
  }
}

/** Frozen `featuredPhotos`: every photo in upload order, capped at 6. */
export function selectFeaturedPhotos(
  uploads: readonly GuestPhotoUpload[],
  limit: number = FEATURED_PHOTO_LIMIT
): FeaturedGuestPhoto[] {
  return uploads
    .flatMap(upload => upload.photoUrls.map(url => ({ url, guestName: upload.guestName })))
    .slice(0, limit)
}

/** Frozen `formatUploadDate` (`Intl.DateTimeFormat('en-US', short/numeric/numeric)`). */
export function formatUploadDate(value: string): string {
  return new Intl.DateTimeFormat(UPLOAD_DATE_LOCALE, UPLOAD_DATE_OPTIONS).format(new Date(value))
}

/* -------------------------------------------------------------------------- */
/* Stub API (deterministic; TODO(Wave3): replace with shared/data/guestUploads)*/
/* -------------------------------------------------------------------------- */

export function createStubGuestPhotosApi(): GuestPhotosApi {
  return {
    loadApprovedUploads: () => Promise.resolve(createGuestPhotosFixture()),
  }
}

/* -------------------------------------------------------------------------- */
/* useGuestPhotosData — load, filter, stats, featured photos, retry            */
/* -------------------------------------------------------------------------- */

export interface UseGuestPhotosDataOptions {
  /** Data seam (Lead swaps for the `shared/data` adapter). */
  api?: GuestPhotosApi
}

export interface UseGuestPhotosDataResult {
  uploads: GuestPhotoUpload[]
  stats: GuestPhotosStats
  featuredPhotos: FeaturedGuestPhoto[]
  isLoading: boolean
  /** Frozen error copy, or `null` when the load succeeded. */
  error: string | null
  /** Re-run the load (used by tests / future retry affordance). */
  reload: () => void
}

export function useGuestPhotosData({
  api,
}: UseGuestPhotosDataOptions = {}): UseGuestPhotosDataResult {
  const client = useMemo(() => api ?? createStubGuestPhotosApi(), [api])
  const [uploads, setUploads] = useState<GuestPhotoUpload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    void client.loadApprovedUploads().then(
      loaded => {
        if (cancelled) return
        setUploads(filterApprovedUploads(loaded))
        setIsLoading(false)
      },
      () => {
        if (cancelled) return
        setUploads([])
        setError(GUEST_PHOTOS_COPY.errorBody)
        setIsLoading(false)
      }
    )

    return () => {
      cancelled = true
    }
  }, [client, reloadToken])

  const stats = useMemo(() => computeGuestPhotosStats(uploads), [uploads])
  const featuredPhotos = useMemo(() => selectFeaturedPhotos(uploads), [uploads])
  const reload = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setReloadToken(previous => previous + 1)
  }, [])

  return { uploads, stats, featuredPhotos, isLoading, error, reload }
}
