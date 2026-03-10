import { supabase } from '@/lib/supabase'
import { compressImage } from '@/utils/imageCompressor'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMemoriesStore } from './memoriesStore'

// Create stable mocks for chained Supabase calls
const mockUpload = vi.fn().mockResolvedValue({ error: null })
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'mock-public-url' } })
const mockRange = vi.fn().mockResolvedValue({ data: [], error: null })
const mockOrder = vi.fn().mockReturnValue({ range: mockRange })
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
const mockSingle = vi.fn().mockResolvedValue({ data: {}, error: null })
const mockInsertSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

// Mock supabase with stable references
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
    })),
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  },
}))

// Mock image compressor
vi.mock('@/utils/imageCompressor', () => ({
  compressImage: vi.fn(file => Promise.resolve(file)),
}))

// Mock rate limiter - allow all requests in tests
vi.mock('@/utils/rateLimiter', () => ({
  rateLimiter: {
    check: vi.fn(() => ({ canProceed: true, timeRemainingMs: 0 })),
    canProceed: vi.fn(() => true),
  },
  formatTimeRemaining: vi.fn((ms) => `${Math.ceil(ms / 1000)} seconds`),
}))

describe('memoriesStore', () => {
  beforeEach(() => {
    // Reset store state
    useMemoriesStore.setState({
      memories: [],
      isLoading: false,
      isSubmitting: false,
      pagination: { page: 0, pageSize: 24, hasMore: true },
      form: { name: '', message: '', photo: undefined, altText: '', tags: [] },
    })

    // Clear all mocks
    vi.clearAllMocks()

    // Reset default mock implementations
    mockRange.mockResolvedValue({ data: [], error: null })
    mockSingle.mockResolvedValue({ data: {}, error: null })
    mockUpload.mockResolvedValue({ error: null })
  })

  it('should initialize with default state', () => {
    const state = useMemoriesStore.getState()
    expect(state.memories).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.form.name).toBe('')
    expect(state.form.altText).toBe('')
  })

  describe('setFormField', () => {
    it('should update form fields', () => {
      useMemoriesStore.getState().setFormField('name', 'Test Name')
      expect(useMemoriesStore.getState().form.name).toBe('Test Name')
      useMemoriesStore.getState().setFormField('altText', 'Test Alt Text')
      expect(useMemoriesStore.getState().form.altText).toBe('Test Alt Text')
    })
  })

  describe('resetForm', () => {
    it('should reset the form to initial state', () => {
      useMemoriesStore.setState({
        form: {
          name: 'Filled',
          message: 'Filled',
          photo: new File([], 'test.jpg'),
          altText: 'Filled',
          tags: [],
        },
      })
      useMemoriesStore.getState().resetForm()
      expect(useMemoriesStore.getState().form).toEqual({
        name: '',
        message: '',
        photo: undefined,
        altText: '',
		tags: [],
      })
    })
  })

  describe('submitMemory - Zod Validation', () => {
    it('should return error if name is missing', async () => {
      useMemoriesStore.getState().setFormField('name', '')
      useMemoriesStore.getState().setFormField('message', 'A message')
      const result = await useMemoriesStore.getState().submitMemory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Please enter your name')
    })

    it('should return error if both message and photo are missing', async () => {
      useMemoriesStore.getState().setFormField('name', 'Test')
      useMemoriesStore.getState().setFormField('message', '')
      useMemoriesStore.getState().setFormField('photo', undefined)
      const result = await useMemoriesStore.getState().submitMemory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Please enter a message or add a photo')
    })

    it('should return error if photo is present but altText is missing', async () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' })
      useMemoriesStore.getState().setFormField('name', 'Test')
      useMemoriesStore.getState().setFormField('message', '')
      useMemoriesStore.getState().setFormField('photo', mockFile)
      useMemoriesStore.getState().setFormField('altText', '')
      const result = await useMemoriesStore.getState().submitMemory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Please provide alt text for the photo.')
    })

    it('should pass validation with message only', async () => {
      useMemoriesStore.getState().setFormField('name', 'Test')
      useMemoriesStore.getState().setFormField('message', 'A message')

      // Setup mock return for success
      mockSingle.mockResolvedValue({
        data: { id: '1', name: 'Test', message: 'A message', type: 'message', created_at: 'now' },
        error: null,
      })

      const result = await useMemoriesStore.getState().submitMemory()
      expect(supabase.from).toHaveBeenCalledWith('shared_memories')
      expect(result.success).toBe(true)
    })

    it('should pass validation with photo and altText only', async () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' })
      useMemoriesStore.getState().setFormField('name', 'Test')
      useMemoriesStore.getState().setFormField('message', '')
      useMemoriesStore.getState().setFormField('photo', mockFile)
      useMemoriesStore.getState().setFormField('altText', 'A photo of a test')

      mockSingle.mockResolvedValue({
        data: {
          id: '1',
          name: 'Test',
          photo_url: 'url',
          alt_text: 'alt',
          type: 'photo',
          created_at: 'now',
        },
        error: null,
      })

      const result = await useMemoriesStore.getState().submitMemory()
      expect(supabase.from).toHaveBeenCalledWith('shared_memories')
      expect(result.success).toBe(true)
    })
  })

  describe('submitMemory - Supabase Integration', () => {
    it('should call supabase storage upload and insert with correct data', async () => {
      const mockFile = new File([''], 'test.png', { type: 'image/png' })
      useMemoriesStore.getState().setFormField('name', 'Uploader')
      useMemoriesStore.getState().setFormField('message', 'My lovely photo')
      useMemoriesStore.getState().setFormField('photo', mockFile)
      useMemoriesStore.getState().setFormField('altText', 'A description')

      mockSingle.mockResolvedValue({
        data: {
          id: '123',
          name: 'Uploader',
          message: 'My lovely photo',
          photo_url: 'mock-public-url',
          alt_text: 'A description',
          type: 'both',
          created_at: new Date().toISOString(),
		  tags: []
        },
        error: null,
      })

      const result = await useMemoriesStore.getState().submitMemory()

      expect(result.success).toBe(true)
      expect(compressImage).toHaveBeenCalledWith(mockFile)
      expect(supabase.storage.from).toHaveBeenCalledWith('wedding-photos')
      expect(mockUpload).toHaveBeenCalledWith(expect.stringContaining('guest-uploads/'), mockFile)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Uploader',
          message: 'My lovely photo',
          photo_url: 'mock-public-url',
          alt_text: 'A description',
          type: 'both',
        })
      )
      expect(useMemoriesStore.getState().memories).toHaveLength(1)
      expect(useMemoriesStore.getState().form).toEqual({
        name: '',
        message: '',
        photo: undefined,
        altText: '',
		tags: []
      })
    })

    it('should handle supabase upload error', async () => {
      mockUpload.mockResolvedValueOnce({ error: { message: 'Upload failed' } })

      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' })
      useMemoriesStore.getState().setFormField('name', 'Uploader')
      useMemoriesStore.getState().setFormField('message', 'My photo')
      useMemoriesStore.getState().setFormField('photo', mockFile)
      useMemoriesStore.getState().setFormField('altText', 'Alt text')

      const result = await useMemoriesStore.getState().submitMemory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to upload photo. Please try again.')
    })

    it('should handle supabase insert error', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } })

      useMemoriesStore.getState().setFormField('name', 'Uploader')
      useMemoriesStore.getState().setFormField('message', 'My message')
      const result = await useMemoriesStore.getState().submitMemory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save memory. Please try again.')
    })
  })

  describe('fetchMemories', () => {
    it('should fetch memories and update state', async () => {
      const mockMemoriesData = [
        {
          id: '1',
          name: 'A',
          message: 'Msg A',
          photo_url: 'urlA',
          alt_text: 'Alt A',
          type: 'both',
          created_at: '2023-01-01T00:00:00Z',
          source: 'user',
		  tags: []
        },
        {
          id: '2',
          name: 'B',
          message: 'Msg B',
          photo_url: null,
          alt_text: null,
          type: 'message',
          created_at: '2023-01-02T00:00:00Z',
          source: 'user',
		  tags: []
        },
      ]

      mockRange.mockResolvedValue({ data: mockMemoriesData, error: null })

      await useMemoriesStore.getState().fetchMemories()
      const state = useMemoriesStore.getState()
      expect(state.memories).toEqual([
        {
          id: '1',
          name: 'A',
          message: 'Msg A',
          photo_url: 'urlA',
          altText: 'Alt A',
          type: 'both',
          created_at: '2023-01-01T00:00:00Z',
          source: 'user',
		  tags: []
        },
        {
          id: '2',
          name: 'B',
          message: 'Msg B',
          photo_url: undefined,
          altText: undefined,
          type: 'message',
          created_at: '2023-01-02T00:00:00Z',
          source: 'user',
		  tags: []
        },
      ])
      expect(state.isLoading).toBe(false)
      // Since mockMemoriesData (2) < pageSize (24), hasMore should be false
      expect(state.pagination.hasMore).toBe(false)
    })

    it('should set hasMore to false if no more data', async () => {
      mockRange.mockResolvedValue({ data: [], error: null })
      await useMemoriesStore.getState().fetchMemories()
      expect(useMemoriesStore.getState().pagination.hasMore).toBe(false)
    })

    it('should handle fetch errors', async () => {
      mockRange.mockResolvedValue({ data: null, error: { message: 'Fetch failed' } })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await useMemoriesStore.getState().fetchMemories()

      // Store catches error and sets error state
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching memories:',
        'Fetch failed'
      )
      expect(useMemoriesStore.getState().isLoading).toBe(false)
      expect(useMemoriesStore.getState().error).toBe('Fetch failed')

      consoleErrorSpy.mockRestore()
    })
  })
})
