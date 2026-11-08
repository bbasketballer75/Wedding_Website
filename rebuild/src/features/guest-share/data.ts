/**
 * Guest Share data boundary (Wave 6 W6-3).
 *
 * Deterministic stub + hook so the page renders/tests parity before the typed
 * data layer is wired.
 *
 * TODO(Wave3): the Lead swaps `createStubGuestShareApi` for an adapter over
 * `shared/data/claims.ts`:
 *
 *   loadAlbum(token) -> fetchGuestContributionsByToken(token)   // null => invalid
 *     then photos = dedupePhotos([
 *       ...(await fetchPhotosByUrls(uploadPhotoUrls)),          // frozen merge order
 *       ...contributions.claimedPhotos,                          // Photo -> GuestSharePhoto
 *     ])
 *     and notes = contributions.guestbook.map(mapNote)
 *
 * `null` is the "invalid token" signal; a rejected promise is the "network"
 * signal — exactly the frozen page's `invalid` vs `network` split.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createGuestShareAlbumFixture } from './fixtures'
import type {
  GuestShareAlbum,
  GuestShareApi,
  GuestShareErrorKind,
  GuestShareNote,
  GuestSharePhoto,
  GuestShareStatus,
  GuestShareTab,
} from './types'

/** Token the deterministic stub resolves (matches contracts/fixtures/guestTokens.json). */
export const STUB_VALID_TOKEN = 'valid-showcase-token'

const EMPTY_PHOTOS: GuestSharePhoto[] = []
const EMPTY_NOTES: GuestShareNote[] = []

/* -------------------------------------------------------------------------- */
/* Pure helpers (frozen page logic)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Frozen merge-dedupe: uploaded photos come first, claimed photos after; rows
 * with an id already seen are dropped (first occurrence wins). The frozen page
 * also skipped rows with no id, which this keeps.
 */
export function dedupePhotos(photos: readonly GuestSharePhoto[]): GuestSharePhoto[] {
  const seenIds = new Set<string>()
  const deduped: GuestSharePhoto[] = []

  for (const photo of photos) {
    if (!photo.id || seenIds.has(photo.id)) continue
    seenIds.add(photo.id)
    deduped.push(photo)
  }

  return deduped
}

/** Defensive normalize (dedupe photos; keep note order). */
export function normalizeAlbum(album: GuestShareAlbum): GuestShareAlbum {
  return {
    guestName: album.guestName,
    photos: dedupePhotos(album.photos),
    notes: [...album.notes],
  }
}

export interface AlbumStats {
  photoCount: number
  noteCount: number
}

export function countAlbumStats(album: GuestShareAlbum): AlbumStats {
  return { photoCount: album.photos.length, noteCount: album.notes.length }
}

/**
 * Frozen auto-switch: a guest with notes but no photos lands on the guestbook
 * tab; otherwise the photos tab is active (the frozen default).
 */
export function resolveDefaultTab(album: GuestShareAlbum): GuestShareTab {
  return album.photos.length === 0 && album.notes.length > 0 ? 'guestbook' : 'photos'
}

/* -------------------------------------------------------------------------- */
/* Stub API (deterministic; TODO(Wave3): replace with shared/data/claims)     */
/* -------------------------------------------------------------------------- */

export function createStubGuestShareApi(validToken: string = STUB_VALID_TOKEN): GuestShareApi {
  return {
    loadAlbum: (token: string) =>
      Promise.resolve(token === validToken ? createGuestShareAlbumFixture() : null),
  }
}

/* -------------------------------------------------------------------------- */
/* useGuestShareAlbum — load, dedupe, stats, tab auto-switch, retry            */
/* -------------------------------------------------------------------------- */

interface AlbumState {
  /** Token the state belongs to (`null` for the never-resolved invalid state). */
  token: string | null
  status: GuestShareStatus
  album: GuestShareAlbum | null
  errorKind: GuestShareErrorKind | null
}

function initialStateFor(token: string | null | undefined): AlbumState {
  if (!token) {
    return { token: null, status: 'invalid', album: null, errorKind: 'invalid' }
  }
  return { token, status: 'loading', album: null, errorKind: null }
}

export interface UseGuestShareAlbumOptions {
  /** Data seam (Lead swaps for the `shared/data/claims` adapter). */
  api?: GuestShareApi
  /** Route param; `undefined`/empty behaves like an unresolved link. */
  token: string | null | undefined
}

export interface UseGuestShareAlbumResult {
  status: GuestShareStatus
  album: GuestShareAlbum | null
  guestName: string
  photos: GuestSharePhoto[]
  notes: GuestShareNote[]
  photoCount: number
  noteCount: number
  /** `null` unless `status` is `invalid`/`network`. */
  errorKind: GuestShareErrorKind | null
  activeTab: GuestShareTab
  setActiveTab: (tab: GuestShareTab) => void
  /** Re-run the token resolution (frozen "Try Again" on the network state). */
  retry: () => void
}

export function useGuestShareAlbum({
  api,
  token,
}: UseGuestShareAlbumOptions): UseGuestShareAlbumResult {
  const client = useMemo(() => api ?? createStubGuestShareApi(), [api])
  const [state, setState] = useState<AlbumState>(() => initialStateFor(token))
  const [activeTab, setActiveTab] = useState<GuestShareTab>('photos')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    void client.loadAlbum(token).then(
      loaded => {
        if (cancelled) return
        if (!loaded) {
          setState({ token, status: 'invalid', album: null, errorKind: 'invalid' })
          setActiveTab('photos')
          return
        }

        const normalized = normalizeAlbum(loaded)
        setState({ token, status: 'ready', album: normalized, errorKind: null })
        setActiveTab(resolveDefaultTab(normalized))
      },
      () => {
        if (cancelled) return
        setState({ token, status: 'network', album: null, errorKind: 'network' })
      }
    )

    return () => {
      cancelled = true
    }
  }, [client, token, reloadToken])

  const retry = useCallback(() => {
    if (!token) return
    setState({ token, status: 'loading', album: null, errorKind: null })
    setReloadToken(previous => previous + 1)
  }, [token])

  // Derive against the current token so a route-param change shows the loading
  // state without a synchronous setState inside the effect.
  const current: AlbumState = token
    ? state.token === token
      ? state
      : initialStateFor(token)
    : initialStateFor(null)

  const photos = current.album?.photos ?? EMPTY_PHOTOS
  const notes = current.album?.notes ?? EMPTY_NOTES
  const stats = current.album ? countAlbumStats(current.album) : { photoCount: 0, noteCount: 0 }

  return {
    status: current.status,
    album: current.album,
    guestName: current.album?.guestName ?? '',
    photos,
    notes,
    photoCount: stats.photoCount,
    noteCount: stats.noteCount,
    errorKind: current.errorKind,
    activeTab,
    setActiveTab,
    retry,
  }
}
