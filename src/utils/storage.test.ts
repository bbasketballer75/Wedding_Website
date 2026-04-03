import { describe, it, expect, vi, beforeEach } from 'vitest'
import storage from './storage'

// Mock console.warn to avoid test output noise
vi.spyOn(console, 'warn').mockImplementation(() => {})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: any) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('storage utility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()
    vi.clearAllMocks()
    // Reset storage availability
    storage.isAvailable = true
  })

  describe('when localStorage is available', () => {
    it('stores and retrieves items correctly', () => {
      storage.setItem('test-key', 'test-value')
      expect(storage.getItem('test-key')).toBe('test-value')
    })

    it('returns default value when item does not exist', () => {
      expect(storage.getItem('non-existent', 'default')).toBe('default')
    })

    it('stores and retrieves JSON objects', () => {
      const testObj = { name: 'test', value: 123 }
      storage.setJSON('test-obj', testObj)
      expect(storage.getJSON('test-obj')).toEqual(testObj)
    })

    it('removes items correctly', () => {
      storage.setItem('test-key', 'test-value')
      storage.removeItem('test-key')
      expect(storage.getItem('test-key')).toBe(null)
    })

    it('clears all items', () => {
      storage.setItem('key1', 'value1')
      storage.setItem('key2', 'value2')
      storage.clear()
      expect(storage.getItem('key1')).toBe(null)
      expect(storage.getItem('key2')).toBe(null)
    })

    it('returns boolean for set operations', () => {
      expect(storage.setItem('test', 'value')).toBe(true)
      expect(storage.removeItem('test')).toBe(true)
      expect(storage.clear()).toBe(true)
    })
  })

  describe('when localStorage is not available', () => {
    beforeEach(() => {
      storage.isAvailable = false
    })

    it('returns default value when getting items', () => {
      expect(storage.getItem('test-key', 'default')).toBe('default')
    })

    it('returns false for set operations', () => {
      expect(storage.setItem('test', 'value')).toBe(false)
      expect(storage.removeItem('test')).toBe(false)
      expect(storage.clear()).toBe(false)
    })

    it('returns default value for JSON operations', () => {
      expect(storage.getJSON('test-obj', { default: true })).toEqual({ default: true })
      expect(storage.setJSON('test-obj', { data: 'test' })).toBe(false)
    })
  })

  describe('error handling', () => {
    it('handles localStorage errors gracefully', () => {
      // Mock localStorage to always throw an error
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      // Should not throw an error
      expect(() => storage.setItem('test-key', 'test-value')).not.toThrow()
      // Should return false when error occurs
      expect(storage.setItem('test-key', 'test-value')).toBe(false)
    })

    it('handles JSON parse errors gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('{ invalid json }')
      // Should return default value when JSON is invalid
      expect(storage.getJSON('bad-json', { default: true })).toEqual({ default: true })
    })
  })
})
