import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { compressImage } from './imageCompressor'

describe('imageCompressor utility', () => {
  let originalFileReader: any
  let originalImage: any

  beforeEach(() => {
    vi.clearAllMocks()
    originalFileReader = global.FileReader
    originalImage = global.Image
  })

  afterEach(() => {
    global.FileReader = originalFileReader
    global.Image = originalImage
  })

  it('returns non-image files immediately', async () => {
    const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' })
    const result = await compressImage(textFile)
    expect(result).toBe(textFile)
  })

  it('compresses and resizes image to WebP with renamed extension', async () => {
    // Mock FileReader to trigger onload with dummy data URL
    class MockFileReader {
      onload: any
      readAsDataURL() {
        setTimeout(() => {
          this.onload({ target: { result: 'data:image/jpeg;base64,mock' } })
        }, 10)
      }
    }
    global.FileReader = MockFileReader as any

    // Mock Image to trigger onload with mock width and height
    class MockImage {
      width = 3000
      height = 2000
      onload: any
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 10)
      }
    }
    global.Image = MockImage as any

    // Mock Canvas and toBlob
    const mockBlob = new Blob(['compressed'], { type: 'image/webp' })
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      }),
      toBlob: vi.fn().mockImplementation((cb, type, quality) => {
        expect(type).toBe('image/webp')
        expect(quality).toBe(0.8)
        cb(mockBlob)
      }),
    }
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as any
      }
      return originalImage
    })

    const originalFile = new File(['original raw large content'], 'my-photo.jpg', {
      type: 'image/jpeg',
    })
    const result = await compressImage(originalFile)

    expect(result.name).toBe('my-photo.webp')
    expect(result.type).toBe('image/webp')
    // Canvas dimensions should be scaled down from 3000 to max width 1920
    expect(mockCanvas.width).toBe(1920)
    expect(mockCanvas.height).toBe(1280) // 1920 * 2000 / 3000 = 1280
  })

  it('falls back to original file if canvas context is not available', async () => {
    class MockFileReader {
      onload: any
      readAsDataURL() {
        setTimeout(() => {
          this.onload({ target: { result: 'data:image/jpeg;base64,mock' } })
        }, 10)
      }
    }
    global.FileReader = MockFileReader as any

    class MockImage {
      width = 500
      height = 500
      onload: any
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 10)
      }
    }
    global.Image = MockImage as any

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(null), // canvas context is null
    }
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as any
      }
      return originalImage
    })

    const originalFile = new File(['original content'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await compressImage(originalFile)

    // Falls back to original file
    expect(result).toBe(originalFile)
  })
})
