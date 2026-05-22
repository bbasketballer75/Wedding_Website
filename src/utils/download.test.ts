import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadBatch } from './download'

describe('downloadBatch batch engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    
    // Mock URL object
    global.window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    global.window.URL.revokeObjectURL = vi.fn()
    
    // Mock anchor clicks
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') return mockAnchor as any
      return {} as any
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({} as any))
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => ({} as any))
  })

  it('fails when no photos are provided', async () => {
    await expect(downloadBatch([])).rejects.toThrow('No photos provided')
  })

  it('downloads small batches (<= 20) using client-side zipping', async () => {
    const photos = [
      { id: '1', url: 'https://example.com/1.jpg', thumbnail: '1t.jpg', caption: 'Photo One' },
      { id: '2', url: 'https://example.com/2.jpg', thumbnail: '2t.jpg', caption: 'Photo Two' },
    ]

    const mockBlob = new Blob(['mock image content'], { type: 'image/jpeg' })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    })
    global.fetch = mockFetch

    const progressCalls: [number, string][] = []
    const onProgress = vi.fn((progress, status) => {
      progressCalls.push([progress, status])
    })

    await downloadBatch(photos, onProgress)

    // Verify fetches were triggered
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://example.com/1.jpg')
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://example.com/2.jpg')

    // Verify URL creation was triggered for zip blob download
    expect(global.window.URL.createObjectURL).toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalled()
    
    // Confirm final progress is 100%
    const lastCall = progressCalls[progressCalls.length - 1]
    expect(lastCall[0]).toBe(100)
    expect(lastCall[1]).toContain('finished successfully')
  })

  it('downloads large batches (> 20) using Netlify server-side zipping', async () => {
    // Generate 25 mock photos to trigger server-side packaging
    const photos = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      url: `https://example.com/${i + 1}.jpg`,
      thumbnail: `${i + 1}t.jpg`,
    }))

    // Mock server POST response with stream reader
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
        .mockResolvedValueOnce({ done: true }),
    }
    const mockResponse = {
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'content-length') return '3'
          return null
        },
      },
      body: {
        getReader: () => mockReader,
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(mockResponse)
    global.fetch = mockFetch

    const progressCalls: [number, string][] = []
    const onProgress = vi.fn((progress, status) => {
      progressCalls.push([progress, status])
    })

    await downloadBatch(photos, onProgress)

    // Verify server endpoint was called once with all photoIds
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/download-pack',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: photos.map(p => p.id) }),
      })
    )

    expect(global.window.URL.createObjectURL).toHaveBeenCalled()
    
    // Check final progress calls
    const lastCall = progressCalls[progressCalls.length - 1]
    expect(lastCall[0]).toBe(100)
    expect(lastCall[1]).toContain('Server-zipped downloads finished successfully!')
  })
})
