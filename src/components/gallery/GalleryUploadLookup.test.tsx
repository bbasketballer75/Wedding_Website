import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GalleryUploadLookup } from './GalleryUploadLookup'

vi.mock('@/lib/supabase', () => ({
  fetchGuestUploadStatus: vi.fn(),
}))

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

import { fetchGuestUploadStatus } from '@/lib/supabase'

const mockFetch = vi.mocked(fetchGuestUploadStatus)

describe('GalleryUploadLookup', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders the email form', () => {
    render(<GalleryUploadLookup />)
    expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /look up/i })).toBeInTheDocument()
  })

  it('renders status result when fetchGuestUploadStatus returns data', async () => {
    mockFetch.mockResolvedValueOnce({
      id: 'u1',
      guest_name: 'Jane Doe',
      guest_email: 'jane@example.com',
      message: null,
      photo_urls: [],
      photo_fingerprints: [],
      video_urls: [],
      video_fingerprints: [],
      status: 'approved',
      created_at: '2026-01-01T00:00:00Z',
    } as never)
    render(<GalleryUploadLookup />)
    fireEvent.change(screen.getByPlaceholderText(/your@email.com/i), {
      target: { value: 'jane@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows rejected reason when status is rejected', async () => {
    mockFetch.mockResolvedValueOnce({
      id: 'u2',
      guest_name: 'John',
      guest_email: 'john@example.com',
      message: null,
      photo_urls: [],
      photo_fingerprints: [],
      video_urls: [],
      video_fingerprints: [],
      status: 'rejected',
      rejection_reason: 'Image too dark',
      created_at: '2026-01-01T00:00:00Z',
    } as never)
    render(<GalleryUploadLookup />)
    fireEvent.change(screen.getByPlaceholderText(/your@email.com/i), {
      target: { value: 'john@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await waitFor(() => {
      expect(screen.getByText('Image too dark')).toBeInTheDocument()
    })
  })

  it('does nothing when email is empty', async () => {
    render(<GalleryUploadLookup />)
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    // Should not call fetchGuestUploadStatus
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
