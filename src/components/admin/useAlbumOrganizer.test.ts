import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAlbumOrganizer } from './useAlbumOrganizer'
import type { PhotoAlbum } from '@/lib/supabase'

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

const mockFetchAlbumPhotos = vi.fn()
const mockFetchPhotoAlbumCounts = vi.fn()
const mockFetchPhotoEngagementSummary = vi.fn()
const mockSaveAlbumOrganization = vi.fn()

vi.mock('@/lib/supabase', () => ({
  fetchAlbumPhotos: (...args: unknown[]) => mockFetchAlbumPhotos(...args),
  fetchPhotoAlbumCounts: (...args: unknown[]) => mockFetchPhotoAlbumCounts(...args),
  fetchPhotoEngagementSummary: (...args: unknown[]) => mockFetchPhotoEngagementSummary(...args),
  saveAlbumOrganization: (...args: unknown[]) => mockSaveAlbumOrganization(...args),
  PHOTO_ALBUMS: ['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads'],
}))

function makePhoto(id: string, album: PhotoAlbum = 'Engagement') {
  return {
    id,
    url: `https://example.com/${id}.jpg`,
    thumbnail: `https://example.com/${id}_thumb.jpg`,
    caption: `Photo ${id}`,
    album,
    category: album,
    album_sort_order: 0,
    location: null,
    photographer: null,
    tags: [],
  }
}

async function setupWithPhotos(photos = [makePhoto('a'), makePhoto('b'), makePhoto('c')]) {
  mockFetchPhotoAlbumCounts.mockResolvedValue({
    Engagement: photos.length,
    'Bach+ette': 0,
    'Wedding Day': 0,
    'Guest Uploads': 0,
  })
  mockFetchAlbumPhotos.mockResolvedValue({ data: photos, error: null })
  mockFetchPhotoEngagementSummary.mockResolvedValue({ data: [] })

  const { result } = renderHook(() => useAlbumOrganizer())
  await waitFor(() => expect(result.current.loadingAlbum).toBeNull())
  return result
}

describe('useAlbumOrganizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the default album on mount and populates currentDraft', async () => {
    const result = await setupWithPhotos()
    expect(result.current.selectedAlbum).toBe('Engagement')
    expect(result.current.currentDraft).toHaveLength(3)
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('handleMovePhoto removes the photo from the draft and records a pending move', async () => {
    const result = await setupWithPhotos()
    const targetId = result.current.currentDraft[0].id

    act(() => {
      result.current.handleMovePhoto(targetId, 'Wedding Day')
    })

    expect(result.current.currentDraft.find(p => p.id === targetId)).toBeUndefined()
    expect(result.current.pendingMoves).toHaveLength(1)
    expect(result.current.pendingMoves[0].targetAlbum).toBe('Wedding Day')
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('handleUndoMove restores a moved photo to the draft', async () => {
    const result = await setupWithPhotos()
    const targetId = result.current.currentDraft[0].id

    act(() => {
      result.current.handleMovePhoto(targetId, 'Wedding Day')
    })
    act(() => {
      result.current.handleUndoMove(targetId)
    })

    expect(result.current.currentDraft.find(p => p.id === targetId)).toBeDefined()
    expect(result.current.pendingMoves).toHaveLength(0)
    // Note: undo appends the photo to the END of the draft, so the order differs
    // from saved state and hasUnsavedChanges stays true — that is real behavior.
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('handleDeletePhoto removes the photo and records a pending deletion', async () => {
    const result = await setupWithPhotos()
    const targetId = result.current.currentDraft[1].id

    act(() => {
      result.current.handleDeletePhoto(targetId)
    })

    expect(result.current.currentDraft.find(p => p.id === targetId)).toBeUndefined()
    expect(result.current.pendingDeletes).toHaveLength(1)
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('handleUndoDelete restores a deleted photo to the draft', async () => {
    const result = await setupWithPhotos()
    const targetId = result.current.currentDraft[1].id

    act(() => {
      result.current.handleDeletePhoto(targetId)
    })
    act(() => {
      result.current.handleUndoDelete(targetId)
    })

    expect(result.current.currentDraft.find(p => p.id === targetId)).toBeDefined()
    expect(result.current.pendingDeletes).toHaveLength(0)
  })

  it('handleReset restores the draft from the saved state and clears pending changes', async () => {
    const result = await setupWithPhotos()
    const targetId = result.current.currentDraft[0].id

    act(() => {
      result.current.handleDeletePhoto(targetId)
    })
    expect(result.current.hasUnsavedChanges).toBe(true)

    act(() => {
      result.current.handleReset()
    })

    expect(result.current.currentDraft).toHaveLength(3)
    expect(result.current.pendingMoves).toHaveLength(0)
    expect(result.current.pendingDeletes).toHaveLength(0)
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('selecting photos then handleBulkDelete removes all selected from the draft', async () => {
    const result = await setupWithPhotos()
    const ids = result.current.currentDraft.map(p => p.id)

    act(() => {
      result.current.handleToggleSelected(ids[0])
    })
    act(() => {
      result.current.handleToggleSelected(ids[1])
    })
    act(() => {
      result.current.handleBulkDelete()
    })

    expect(result.current.currentDraft).toHaveLength(1)
    expect(result.current.pendingDeletes).toHaveLength(2)
    expect(result.current.selectedPhotoIds).toHaveLength(0)
  })

  it('switching albums resets search and bulk-action state', async () => {
    mockFetchPhotoAlbumCounts.mockResolvedValue({
      Engagement: 1,
      'Bach+ette': 0,
      'Wedding Day': 0,
      'Guest Uploads': 0,
    })
    mockFetchAlbumPhotos.mockResolvedValue({ data: [makePhoto('x')], error: null })
    mockFetchPhotoEngagementSummary.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useAlbumOrganizer())
    await waitFor(() => expect(result.current.loadingAlbum).toBeNull())

    act(() => {
      result.current.setSearchQuery('test query')
    })
    expect(result.current.searchQuery).toBe('test query')

    act(() => {
      result.current.setSelectedAlbum('Wedding Day')
    })
    await waitFor(() => expect(result.current.loadingAlbum).toBeNull())

    expect(result.current.searchQuery).toBe('')
    expect(result.current.selectedAlbum).toBe('Wedding Day')
  })
})
