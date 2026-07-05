import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock photo-batch-utils relative to scripts folder
const mockReadJson = vi.fn()
const mockWriteJson = vi.fn()
const mockWriteMarkdown = vi.fn()

vi.mock('../../scripts/photo-batch-utils.mjs', () => ({
  readJson: mockReadJson,
  writeJson: mockWriteJson,
  writeMarkdown: mockWriteMarkdown,
}))

// Shared mock functions prefixed with 'mock' so they can be referenced inside vi.mock
const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockIn = vi.fn().mockResolvedValue({ data: [], error: null })
const mockSelect = vi.fn().mockReturnValue({ in: mockIn })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, upsert: mockUpsert })
const mockCreateClientInstance = { from: mockFrom }
const mockCreateClient = vi.fn().mockReturnValue(mockCreateClientInstance)

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}))

describe('sync-guest-photo-face-metadata script', () => {
  let originalArgv: string[]
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    vi.clearAllMocks()
    originalArgv = [...process.argv]
    originalEnv = { ...process.env }
    // Setup env vars
    process.env.VITE_SUPABASE_URL = 'https://supabase.example.com'
    process.env[['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')] = 'service-role-key'
    // Setup arguments
    process.argv = ['node', 'scripts/sync-guest-photo-face-metadata.mjs', '/mock/working/root']

    // Default mock file data
    mockReadJson.mockImplementation(async (filePath: string) => {
      if (filePath.includes('organization-manifest.json')) {
        return [{ id: 'photo-1', relativePath: 'Guest Uploads/category/guest/p1.jpg' }]
      }
      if (filePath.includes('face-annotations-by-photo.json')) {
        return [
          {
            recordId: 'photo-1',
            relativePath: 'Guest Uploads/category/guest/p1.jpg',
            faces: [
              {
                clusterId: 'cluster-1',
                x: 10,
                y: 20,
                box: { left: 5, top: 5, width: 10, height: 10 },
              },
            ],
          },
        ]
      }
      if (filePath.includes('face-review.json')) {
        return [{ clusterId: 'cluster-1', confirmedName: 'Alice Smith' }]
      }
      return []
    })
  })

  afterEach(() => {
    process.argv = originalArgv
    process.env = originalEnv as any
  })

  it('runs sync script and updates Supabase photo faces', async () => {
    // Setup mock Supabase existing row
    mockIn.mockResolvedValueOnce({
      data: [{ id: 'photo-1', url: 'https://r2.example.com/p1.jpg', faces: [] }],
      error: null,
    })

    // Import and execute the script dynamically
    await import('../../scripts/sync-guest-photo-face-metadata.mjs')

    // Verify Supabase fetch query
    expect(mockFrom).toHaveBeenCalledWith('photos')
    expect(mockSelect).toHaveBeenCalledWith('id, url, faces')
    expect(mockIn).toHaveBeenCalledWith('id', ['photo-1'])

    // Verify Supabase update (upsert)
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          id: 'photo-1',
          url: 'https://r2.example.com/p1.jpg',
          faces: [
            {
              id: 'cluster-1-1',
              name: 'Alice Smith',
              x: 10,
              y: 20,
              box: { left: 5, top: 5, width: 10, height: 10 },
            },
          ],
        },
      ],
      { onConflict: 'id' }
    )

    // Verify report writing
    expect(mockWriteJson).toHaveBeenCalledWith(
      expect.stringContaining('guest-photo-face-sync-report.json'),
      expect.objectContaining({
        updatedPhotoRows: 1,
        unchangedPhotoRows: 0,
        missingPhotoRows: 0,
      })
    )
    expect(mockWriteMarkdown).toHaveBeenCalledWith(
      expect.stringContaining('guest-photo-face-sync-report.md'),
      expect.any(Array)
    )
  })
})
