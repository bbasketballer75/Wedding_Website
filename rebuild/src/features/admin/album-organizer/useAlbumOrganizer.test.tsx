import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ALBUM_ORGANIZER_FIXTURES, type AlbumOrganizerData } from './album-organizer-data'
import {
  buildSaveRequest,
  countReorderedPositions,
  filterOrganizerPhotos,
  hasDirtyChanges,
  movePhotoByOffset,
  moveSelectedAfter,
  moveSelectedToBoundary,
  moveSelectOptions,
  photosHaveSameOrder,
  reorderPhotos,
} from './organizer-utils'
import { useAlbumOrganizer } from './useAlbumOrganizer'

const engagement = ALBUM_ORGANIZER_FIXTURES.fetchAlbumPhotos('Engagement')

describe('organizer-utils', () => {
  it('exposes the non-origin albums and order helpers', async () => {
    const photos = await engagement
    expect(moveSelectOptions('Engagement')).toEqual(['Bach+ette', 'Wedding Day', 'Guest Uploads'])
    expect(photosHaveSameOrder(photos, [...photos])).toBe(true)
    expect(photosHaveSameOrder(photos, photos.slice(0, 2))).toBe(false)
    expect(countReorderedPositions(photos, photos)).toBe(0)

    const swapped = [photos[1]!, photos[0]!, photos[2]!]
    expect(countReorderedPositions(photos, swapped)).toBe(2)
    expect(photosHaveSameOrder(photos, swapped)).toBe(false)
  })

  it('reorders, moves by offset and ignores unknown ids', async () => {
    const photos = await engagement
    expect(reorderPhotos(photos, 'eng-1', 'eng-3').map(photo => photo.id)).toEqual([
      'eng-2',
      'eng-3',
      'eng-1',
    ])
    expect(reorderPhotos(photos, 'missing', 'eng-3')).toHaveLength(3)
    expect(reorderPhotos(photos, 'eng-1', 'missing')).toHaveLength(3)

    expect(movePhotoByOffset(photos, 'eng-1', 1).map(photo => photo.id)).toEqual([
      'eng-2',
      'eng-1',
      'eng-3',
    ])
    expect(movePhotoByOffset(photos, 'eng-1', -1)).toEqual([...photos])
    expect(movePhotoByOffset(photos, 'eng-3', 1)).toEqual([...photos])
    expect(movePhotoByOffset(photos, 'missing', 1)).toEqual([...photos])
  })

  it('moves selections to boundaries and after anchors, including no-ops', async () => {
    const photos = await engagement
    expect(moveSelectedToBoundary(photos, new Set(), 'top')).toEqual([...photos])
    expect(
      moveSelectedToBoundary(photos, new Set(['eng-1']), 'bottom').map(photo => photo.id)
    ).toEqual(['eng-2', 'eng-3', 'eng-1'])
    expect(moveSelectedAfter(photos, new Set(), 'eng-2')).toEqual([...photos])
    expect(moveSelectedAfter(photos, new Set(['eng-1']), 'missing')).toEqual([...photos])
    expect(moveSelectedAfter(photos, new Set(['eng-1']), 'eng-3').map(photo => photo.id)).toEqual([
      'eng-2',
      'eng-3',
      'eng-1',
    ])
  })

  it('filters by search terms and builds dirty-diff save requests only', async () => {
    const photos = await engagement
    expect(filterOrganizerPhotos(photos, '')).toHaveLength(3)
    expect(filterOrganizerPhotos(photos, 'orchard').map(photo => photo.id)).toEqual(['eng-2'])
    expect(filterOrganizerPhotos(photos, 'nothing-matches')).toHaveLength(0)

    expect(
      hasDirtyChanges({
        album: 'Engagement',
        saved: photos,
        draft: photos,
        pendingMoves: [],
        pendingDeletes: [],
      })
    ).toBe(false)

    const request = buildSaveRequest({
      album: 'Engagement',
      saved: photos,
      draft: [photos[1]!, photos[2]!],
      pendingMoves: [{ photo: photos[0]!, targetAlbum: 'Wedding Day' }],
      pendingDeletes: [],
    })
    expect(request).toEqual({
      album: 'Engagement',
      order: ['eng-2', 'eng-3'],
      moves: [{ photoId: 'eng-1', targetAlbum: 'Wedding Day' }],
      deletes: [],
    })
  })
})

describe('useAlbumOrganizer guards', () => {
  it('surfaces read and save failures without crashing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: AlbumOrganizerData = {
      fetchAlbumPhotos: () => Promise.reject(new Error('offline')),
      fetchAlbumCounts: () => Promise.reject(new Error('offline')),
      saveAlbumOrganization: () => Promise.reject(new Error('offline')),
    }

    const { result } = renderHook(() => useAlbumOrganizer({ data: failing }))
    await waitFor(() =>
      expect(result.current.saveError).toBe('Could not load the Engagement album.')
    )

    // Save with no dirty state is a no-op.
    await result.current.save()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('ignores undo for unknown moves/deletes and bulk actions without a selection', async () => {
    const { result } = renderHook(() => useAlbumOrganizer({ data: ALBUM_ORGANIZER_FIXTURES }))
    await waitFor(() =>
      expect(result.current.currentDraft.map(photo => photo.id)).toEqual([
        'eng-1',
        'eng-2',
        'eng-3',
      ])
    )

    result.current.undoMove('missing')
    result.current.undoDelete('missing')
    result.current.bulkMoveSelected('Wedding Day')
    result.current.bulkDeleteSelected()

    expect(result.current.pendingMoves).toHaveLength(0)
    expect(result.current.pendingDeletes).toHaveLength(0)
    expect(result.current.currentDraft).toHaveLength(3)
  })

  it('reset restores the saved order and clears the dirty state', async () => {
    const { result } = renderHook(() => useAlbumOrganizer({ data: ALBUM_ORGANIZER_FIXTURES }))
    await waitFor(() => expect(result.current.currentDraft).toHaveLength(3))

    act(() => result.current.movePhotoBy('eng-1', 1))
    expect(result.current.hasUnsavedChanges).toBe(true)

    act(() => result.current.resetDraft())
    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(result.current.currentDraft.map(photo => photo.id)).toEqual(['eng-1', 'eng-2', 'eng-3'])
  })

  it('surfaces a save failure when the seam rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const data: AlbumOrganizerData = {
      ...ALBUM_ORGANIZER_FIXTURES,
      saveAlbumOrganization: () => Promise.reject(new Error('offline')),
    }
    const { result } = renderHook(() => useAlbumOrganizer({ data }))
    await waitFor(() => expect(result.current.currentDraft).toHaveLength(3))

    act(() => result.current.movePhotoBy('eng-1', 1))
    await act(async () => {
      await result.current.save()
    })

    await waitFor(() =>
      expect(result.current.saveError).toBe('Could not save the Engagement arrangement.')
    )
    expect(result.current.savingAlbum).toBeNull()
  })

  it('selects visible, clears selection and bulk-deletes the selection', async () => {
    const { result } = renderHook(() => useAlbumOrganizer({ data: ALBUM_ORGANIZER_FIXTURES }))
    await waitFor(() => expect(result.current.currentDraft).toHaveLength(3))

    act(() => result.current.selectVisible())
    expect(result.current.selectedPhotoIds).toHaveLength(3)
    act(() => result.current.clearSelection())
    expect(result.current.selectedPhotoIds).toHaveLength(0)

    act(() => result.current.toggleSelected('eng-1'))
    act(() => result.current.toggleSelected('eng-2'))
    act(() => result.current.bulkDeleteSelected())
    expect(result.current.pendingDeletes).toHaveLength(2)
    expect(result.current.currentDraft.map(photo => photo.id)).toEqual(['eng-3'])
  })
})
