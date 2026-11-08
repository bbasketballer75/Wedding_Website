import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PHOTO_ALBUMS, fetchAlbumPhotos, type Photo, type PhotoAlbum } from '@/shared/data/photos'
import { PRINT_MAX_PHOTOS_DEFAULT, clampPrintMaxPhotos } from './printCopy'
import type {
  LoadPrintAlbumPhotos,
  PrintAlbumState,
  UsePrintAlbumsOptions,
  UsePrintAlbumsResult,
} from './printTypes'

/**
 * Album selection + lazy loading for `/print`.
 *
 * Frozen behaviour (`src/pages/Print.tsx:148-209`):
 * - all four `PHOTO_ALBUMS` rows are listed, in frozen DB order;
 * - `Wedding Day` starts included and is pre-loaded once on mount;
 * - toggling an album on loads it only when it has no photos yet;
 * - the printed photo count is `sum(min(photos.length, maxPhotosPerAlbum))`.
 *
 * Data binding: the default loader is the Wave-3 data layer
 * (`fetchAlbumPhotos`, ordered by `album_sort_order` then `created_at`), so the
 * page works without route-level data props. The loader is injectable for tests
 * and for parity/e2e fixtures.
 *
 * TODO(Wave4 Lead): no additional wiring is required for production data; keep
 * the seam if the route later needs a Query-cache-backed loader.
 */
const DEFAULT_PRELOADED_ALBUM: PhotoAlbum = 'Wedding Day'

const defaultLoadAlbumPhotos: LoadPrintAlbumPhotos = album => fetchAlbumPhotos(album)

function createInitialAlbumStates(): readonly PrintAlbumState[] {
  return PHOTO_ALBUMS.map(album => ({
    album,
    included: album === DEFAULT_PRELOADED_ALBUM,
    photos: [],
    loading: album === DEFAULT_PRELOADED_ALBUM,
  }))
}

export function usePrintAlbums(options: UsePrintAlbumsOptions = {}): UsePrintAlbumsResult {
  const loader = options.loadAlbumPhotos ?? defaultLoadAlbumPhotos

  // Keep the latest injected loader without re-triggering the one-shot preload
  // when callers pass a fresh function identity (tests pass stable mocks; the
  // default binding is a module constant).
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  const [albumStates, setAlbumStates] =
    useState<readonly PrintAlbumState[]>(createInitialAlbumStates)
  const [maxPhotosPerAlbum, setMaxPhotosPerAlbumState] = useState<number>(PRINT_MAX_PHOTOS_DEFAULT)
  const inFlightAlbumsRef = useRef<Set<PhotoAlbum>>(new Set<PhotoAlbum>())

  const fetchAlbum = useCallback(async (album: PhotoAlbum): Promise<readonly Photo[]> => {
    if (inFlightAlbumsRef.current.has(album)) return []
    inFlightAlbumsRef.current.add(album)

    try {
      const photos: readonly Photo[] = await loaderRef.current(album)
      setAlbumStates(previous =>
        previous.map(state =>
          state.album === album ? { ...state, photos, loading: false } : state
        )
      )
      return photos
    } catch (error) {
      console.error(`Print: could not load the ${album} album.`, error)
      setAlbumStates(previous =>
        previous.map(state =>
          state.album === album ? { ...state, photos: [], loading: false } : state
        )
      )
      return []
    } finally {
      inFlightAlbumsRef.current.delete(album)
    }
  }, [])

  // Frozen behaviour: pre-load the default album once on mount. The initial
  // state marks it as loading, so the effect itself performs no synchronous
  // state update.
  useEffect(() => {
    void fetchAlbum(DEFAULT_PRELOADED_ALBUM)
  }, [fetchAlbum])

  const toggleAlbum = useCallback(
    (album: PhotoAlbum): void => {
      const current = albumStates.find(state => state.album === album)
      if (!current) return

      const included = !current.included
      const shouldLoad = included && current.photos.length === 0

      setAlbumStates(previous =>
        previous.map(state =>
          state.album === album
            ? { ...state, included, loading: shouldLoad ? true : state.loading }
            : state
        )
      )

      // Lazy load on first include, exactly like the frozen page.
      if (shouldLoad) void fetchAlbum(album)
    },
    [albumStates, fetchAlbum]
  )

  const setMaxPhotosPerAlbum = useCallback((value: number): void => {
    setMaxPhotosPerAlbumState(clampPrintMaxPhotos(value))
  }, [])

  const includedAlbums = useMemo(() => albumStates.filter(state => state.included), [albumStates])

  const totalPhotoCount = useMemo(
    () =>
      includedAlbums.reduce(
        (total, state) => total + Math.min(state.photos.length, maxPhotosPerAlbum),
        0
      ),
    [includedAlbums, maxPhotosPerAlbum]
  )

  return {
    albumStates,
    includedAlbums,
    totalPhotoCount,
    maxPhotosPerAlbum,
    setMaxPhotosPerAlbum,
    toggleAlbum,
    loadAlbumPhotos: fetchAlbum,
  }
}
