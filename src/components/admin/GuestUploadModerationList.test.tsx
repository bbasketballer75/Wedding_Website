import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GuestUploadModerationList } from './GuestUploadModerationList'
import * as supabaseLib from '@/lib/supabase'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/lib/supabase', () => ({
  fetchGuestUploadsByStatus: vi.fn(),
  approveGuestUpload: vi.fn(),
  rejectGuestUpload: vi.fn(),
  bulkApproveGuestUploads: vi.fn(),
  bulkRejectGuestUploads: vi.fn(),
  publishGuestUploadPhotosToAlbum: vi.fn(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      user: { id: 'admin-id', email: 'admin@example.com' },
    }),
  },
}))

const mockPendingUploads = [
  {
    id: 'upload-1',
    guest_name: 'John Doe',
    guest_email: 'john@example.com',
    message: 'Congrats on your big day!',
    photo_urls: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'],
    photo_fingerprints: ['f1', 'f2'],
    video_urls: [],
    video_fingerprints: [],
    status: 'pending' as const,
    created_at: '2026-06-07T12:00:00Z',
    rejection_reason: null,
  },
]

describe('GuestUploadModerationList and API requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabaseLib.fetchGuestUploadsByStatus).mockResolvedValue(mockPendingUploads)
  })

  it('renders pending uploads in a grid layout containing all photo previews', async () => {
    render(<GuestUploadModerationList />)

    // Wait for uploads to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    expect(screen.getByText('Congrats on your big day!')).toBeInTheDocument()

    // Verify photos are rendered
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', 'https://example.com/p1.jpg')
    expect(images[1]).toHaveAttribute('src', 'https://example.com/p2.jpg')

    // Verify the grid container wrapper has grid layout classes
    const gridContainer = screen.getByTestId('photo-preview-grid')
    expect(gridContainer).toHaveClass('grid')
  })

  it('handles approve action correctly calling the Supabase API', async () => {
    vi.mocked(supabaseLib.approveGuestUpload).mockResolvedValue({ success: true } as any)

    render(<GuestUploadModerationList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const approveButton = screen.getByText('Approve')
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(supabaseLib.approveGuestUpload).toHaveBeenCalledWith(
        'upload-1',
        expect.objectContaining({
          userId: 'admin-id',
          email: 'admin@example.com',
        })
      )
    })
  })

  it('handles reject action with reason correctly calling the Supabase API', async () => {
    vi.mocked(supabaseLib.rejectGuestUpload).mockResolvedValue({ success: true } as any)

    render(<GuestUploadModerationList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const rejectButton = screen.getByText('Reject')
    fireEvent.click(rejectButton)

    // Verify reject dialog opens
    const textarea = screen.getByPlaceholderText('Optional: Let the guest know why...')
    fireEvent.change(textarea, { target: { value: 'Inappropriate content' } })

    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    const confirmRejectButton = rejectButtons[1] || rejectButtons[0]
    fireEvent.click(confirmRejectButton)

    await waitFor(() => {
      expect(supabaseLib.rejectGuestUpload).toHaveBeenCalledWith(
        'upload-1',
        'Inappropriate content',
        expect.objectContaining({
          userId: 'admin-id',
          email: 'admin@example.com',
        })
      )
    })
  })
})
