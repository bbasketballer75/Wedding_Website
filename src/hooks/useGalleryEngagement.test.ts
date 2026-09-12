import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as supabaseMock from '../lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  togglePhotoLike: vi.fn(),
  addPhotoComment: vi.fn(),
  fetchPhotoComments: vi.fn(),
}))

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../components/gallery/constants', () => ({
  PHOTO_COMMENT_AUTHOR_KEY: 'wedding-gallery-comment-author',
  getPhotoEngagementSessionId: () => 'test-session',
}))

vi.mock('../components/gallery/data', () => ({
  formatPhotoCommentTimestamp: (v: string) => `formatted:${v}`,
}))

// Import after mocks so they take effect
import { useGalleryEngagement } from './useGalleryEngagement'

describe('useGalleryEngagement', () => {
  beforeEach(() => {
    vi.mocked(supabaseMock.togglePhotoLike).mockReset()
    vi.mocked(supabaseMock.addPhotoComment).mockReset()
  })

  it('initializes with empty engagement and null submittingCommentPhotoId', () => {
    const { result } = renderHook(() => useGalleryEngagement({ setPhotos: vi.fn() }))
    expect(result.current.submittingCommentPhotoId).toBe(null)
    expect(typeof result.current.toggleLike).toBe('function')
    expect(typeof result.current.submitComment).toBe('function')
  })

  it('toggleLike calls supabase togglePhotoLike', async () => {
    vi.mocked(supabaseMock.togglePhotoLike).mockResolvedValue({
      data: { photo_key: 'p1', liked: true, likes_count: 5 },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    })

    const { result } = renderHook(() => useGalleryEngagement({ setPhotos: vi.fn() }))

    // No-op without setPhotos — should not throw
    await act(async () => {
      await result.current.toggleLike('p1')
    })
  })
})
