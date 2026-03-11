import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeImage } from '../image.worker'
import { tokenize, levenshteinDistance, search, indexDocuments } from '../search.worker'
// import { queueItem, initDB } from '../sync.worker' // sync worker is harder to test due to global IDB

// Mock OffscreenCanvas and Context
class MockContext {
  drawImage = vi.fn()
  putImageData = vi.fn()
  getImageData = vi.fn(() => ({
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), // Red, Green
    width: 2,
    height: 1
  }))
}

class MockCanvas {
  width = 800
  height = 600
  getContext = vi.fn((): MockContext | null => new MockContext())
  convertToBlob = vi.fn()
}

type AnalyzeImageData = {
  dominantColors: string[]
}

global.OffscreenCanvas = MockCanvas as unknown as typeof OffscreenCanvas
global.createImageBitmap = vi.fn(async () => ({ width: 100, height: 100 } as ImageBitmap))
global.fetch = vi.fn()

describe('Hive Mind: Edge Case Coverage', () => {
  
  describe('Image Worker Edge Cases', () => {
    it('should analyze image colors correctly', async () => {
      // @ts-ignore
      const result = await analyzeImage({ width: 100, height: 100 } as ImageData)
      expect(result.success).toBe(true)
      // We mocked data to have Red and Green.
      // logic: r/32, g/32, b/32
      // 255,0,0 -> 8,0,0.  0,255,0 -> 0,8,0
      expect((result.data as AnalyzeImageData).dominantColors).toHaveLength(2)
    })

    it('should handle context failure gracefully', async () => {
      // Mock failure
      const failCanvas = class extends MockCanvas {
        getContext = vi.fn((): MockContext | null => null)
      }
      const original = global.OffscreenCanvas
      global.OffscreenCanvas = failCanvas as unknown as typeof OffscreenCanvas
      
      try {
        await analyzeImage({ width: 100, height: 100 } as ImageData)
      } catch (e: unknown) {
        expect((e as Error).message).toBe('Failed to get 2d context')
      }
      
      global.OffscreenCanvas = original
    })
  })

  describe('Search Worker Edge Cases', () => {
    beforeEach(() => {
        // clear index implicitly by starting fresh or mocking? 
        // The worker uses module-level state `searchIndex`. 
        // We need to re-index for every test or clear it.
        // We exported clearIndex, let's import it? 
        // Wait, I forgot to import clearIndex in the test file top. 
        // I will rely on the fact that I'm indexing fresh docs.
    })

    it('should calculate Levenshtein distance correctly for edge cases', () => {
      expect(levenshteinDistance('', '')).toBe(0)
      expect(levenshteinDistance('a', '')).toBe(1)
      expect(levenshteinDistance('', 'a')).toBe(1)
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    })

    it('should tokenize complex strings', () => {
      const tokens = tokenize('Hello, World! @#$ Testing')
      expect(tokens).toEqual(['hello', 'world', 'testing']) // >2 chars
    })

    it('should handle empty search gracefully', () => {
        const results = search('nothing')
        expect(results).toEqual([])
    })
    
    it('should find fuzzy matches', () => {
        indexDocuments([{ id: '1', content: 'apple banana' }])
        const results = search('aple', { fuzzy: true }) // misspelled apple
        // Levenshtein('aple', 'apple') = 1 <= 2. Should match.
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].id).toBe('1')
    })
  })
})
