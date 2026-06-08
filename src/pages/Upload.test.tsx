import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadPage from './Upload'
import * as compressor from '@/utils/imageCompressor'

// Mock DOM APIs not available in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn()
window.URL.createObjectURL = vi.fn().mockReturnValue('mock-object-url')
window.URL.revokeObjectURL = vi.fn()

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
  getOrCreateShareToken: vi.fn().mockResolvedValue('mock-share-token'),
}))

vi.mock('@/components/seo/SEOHead', () => ({
  UploadSEO: () => null,
}))

// Mock imageCompressor utility
vi.spyOn(compressor, 'compressImage')

describe('Photo Upload UI and Features', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock localStorage to behave like a simple in-memory key-value store
    const store: Record<string, string> = {}
    vi.mocked(window.localStorage.getItem).mockImplementation(key => store[key] || null)
    vi.mocked(window.localStorage.setItem).mockImplementation((key, val) => {
      store[key] = val
    })
    vi.mocked(window.localStorage.removeItem).mockImplementation(key => {
      delete store[key]
    })
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      for (const k in store) delete store[k]
    })

    // Mock fetch for presigned upload URLs
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uploadUrl: 'https://r2.example.com/upload',
        publicUrl: 'https://r2.example.com/public/photo.webp',
      }),
    })

    // Mock XMLHttpRequest for direct R2 upload progress
    const mockXHR = {
      upload: {
        addEventListener: vi.fn((event, cb) => {
          if (event === 'progress') {
            // Simulate 50% progress call
            setTimeout(() => cb({ lengthComputable: true, loaded: 50, total: 100 }), 10)
          }
        }),
      },
      addEventListener: vi.fn((event, cb) => {
        if (event === 'load') {
          setTimeout(() => {
            mockXHR.status = 200
            cb()
          }, 20)
        }
      }),
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      status: 200,
      timeout: 0,
    }
    // Use standard constructor to avoid vi.fn() warnings
    global.XMLHttpRequest = function () {
      return mockXHR
    } as any
  })

  it('renders dropzone, accepts file drop/select and displays image preview', async () => {
    render(<UploadPage />)

    // Verify dropzone input is present
    const fileInput = screen.getByLabelText('Select photos or videos to upload')
    expect(fileInput).toBeInTheDocument()

    // Simulate selecting a file
    const file = new File(['dummy content'], 'wedding-photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Verify file name is shown in the queue
    await waitFor(() => {
      expect(screen.getByText('wedding-photo.jpg')).toBeInTheDocument()
    })
  })

  it('converts dropped/selected images to WebP via client-side compression', async () => {
    // Mock the compressImage function to return a WebP file
    const compressedFile = new File(['compressed content'], 'wedding-photo.webp', {
      type: 'image/webp',
    })
    vi.mocked(compressor.compressImage).mockResolvedValue(compressedFile)

    render(<UploadPage />)

    const fileInput = screen.getByLabelText('Select photos or videos to upload')
    const originalFile = new File(['original raw large content'], 'wedding-photo.jpg', {
      type: 'image/jpeg',
    })

    fireEvent.change(fileInput, { target: { files: [originalFile] } })

    // Verify that compressImage was called
    await waitFor(() => {
      expect(compressor.compressImage).toHaveBeenCalledWith(originalFile)
    })

    // Verify the WebP version's name and type are displayed / used
    await waitFor(() => {
      expect(screen.getByText('wedding-photo.webp')).toBeInTheDocument()
    })
  })

  it('renders a multi-file upload progress bar showing aggregate progress', async () => {
    render(<UploadPage />)

    const fileInput = screen.getByLabelText('Select photos or videos to upload')
    const file1 = new File(['image1'], 'img1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['image2'], 'img2.jpg', { type: 'image/jpeg' })

    // Add two files to start uploads
    fireEvent.change(fileInput, { target: { files: [file1, file2] } })

    // Verify that the multi-file aggregate progress bar is rendered
    await waitFor(() => {
      const overallProgress = screen.getByTestId('multi-file-progress-bar')
      expect(overallProgress).toBeInTheDocument()
    })
  })
})
