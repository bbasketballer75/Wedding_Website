import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGalleryEngagement, useGalleryPhotos } from './data'
import { CURATED_PHOTOS, LIVE_PHOTOS } from './fixtures'

describe('useGalleryPhotos (Wave-5 stub data boundary)', () => {
  it('merges curated + live rows with the default deterministic source', () => {
    const { result } = renderHook(() => useGalleryPhotos())

    expect(result.current.photos).toHaveLength(40)
    expect(result.current.photos[0]?.id).toBe(CURATED_PHOTOS[0]?.id)
    expect(result.current.curatedPhotos).toHaveLength(35)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.loadError).toBeNull()
  })

  it('keeps the curated photos when the live fetch fails (frozen fallback contract)', () => {
    const { result } = renderHook(() =>
      useGalleryPhotos({
        curated: CURATED_PHOTOS,
        live: [],
        loadError:
          'The live gallery is taking a moment — the collections below are still ready to explore.',
      })
    )

    expect(result.current.photos).toHaveLength(35)
    expect(result.current.loadError).toMatch(/collections below are still ready/)
  })

  it('passes the loading state through for the skeleton state', () => {
    const { result } = renderHook(() =>
      useGalleryPhotos({ curated: [], live: [], isLoading: true })
    )
    expect(result.current.isLoading).toBe(true)
    expect(result.current.photos).toEqual([])
  })

  it('dedupes live rows that duplicate curated media', () => {
    const duplicate = { ...(LIVE_PHOTOS[0] as (typeof LIVE_PHOTOS)[number]) }
    duplicate.id = 'live-duplicate'
    duplicate.url = CURATED_PHOTOS[0]?.url ?? duplicate.url
    duplicate.thumbnail = CURATED_PHOTOS[0]?.thumbnail ?? duplicate.thumbnail
    const { result } = renderHook(() =>
      useGalleryPhotos({ curated: CURATED_PHOTOS, live: [duplicate] })
    )
    expect(result.current.photos).toHaveLength(35)
  })

  it('provides stable no-op engagement actions for Wave 5', async () => {
    const { result } = renderHook(() => useGalleryEngagement())
    await expect(result.current.toggleLike('curated-1')).resolves.toBeUndefined()
    await expect(result.current.submitComment('curated-1', 'Lovely')).resolves.toBeUndefined()
  })
})
