import { describe, expect, it, vi } from 'vitest'
import type { FilmHighlight } from '@/shared/data/guestUploads'
import {
  fetchFilmGuestClips,
  mapFilmHighlightsToGuestClips,
  selectFilmClipsFromUploadRecords,
  toFilmGuestUploadRecord,
} from '@/app/routes/film-clips-adapter'
import {
  FILM_GUEST_CLIP_BADGE,
  FILM_GUEST_CLIP_DEFAULT_DESCRIPTION,
  FILM_GUEST_CLIP_DEFAULT_TRAIL,
  FILM_GUEST_CLIP_LIMIT,
  type FilmGuestUploadRecord,
} from './filmGuestClips'

function highlight(overrides: Partial<FilmHighlight> = {}): FilmHighlight {
  return {
    id: 'upload-1-0',
    uploadId: 'upload-1',
    guestName: 'Jamie Rivera',
    title: 'Right after the toasts',
    description: 'Right after the toasts',
    videoUrl: 'https://cdn.example.com/clip-1.mp4',
    createdAt: '2025-05-11T10:00:00.000Z',
    badge: 'From your phones',
    memoryTrail: 'ceremony',
    ...overrides,
  }
}

function fallbackHighlight(overrides: Partial<FilmHighlight> = {}): FilmHighlight {
  return highlight({
    id: 'upload-2-1',
    uploadId: 'upload-2',
    guestName: 'Morgan Lee',
    title: 'A moment from Morgan Lee',
    description: FILM_GUEST_CLIP_DEFAULT_DESCRIPTION,
    videoUrl: 'https://cdn.example.com/clip-2.mp4',
    memoryTrail: null,
    ...overrides,
  })
}

function uploadRecord(overrides: Partial<FilmGuestUploadRecord> = {}): FilmGuestUploadRecord {
  return {
    id: 'upload-1',
    guest_name: 'Jamie Rivera',
    message: 'Our table, right after the toasts.',
    video_urls: ['https://cdn.example.com/clip-1.mp4'],
    created_at: '2025-05-11T10:00:00.000Z',
    status: 'approved',
    video_visibility: 'guest_highlights',
    memory_trail: 'ceremony',
    ...overrides,
  }
}

describe('film-clips adapter: highlight → upload record', () => {
  it('maps the data-layer shape back onto the feature contract', () => {
    expect(toFilmGuestUploadRecord(highlight())).toEqual({
      id: 'upload-1',
      guest_name: 'Jamie Rivera',
      message: 'Right after the toasts',
      video_urls: ['https://cdn.example.com/clip-1.mp4'],
      created_at: '2025-05-11T10:00:00.000Z',
      status: 'approved',
      video_visibility: 'guest_highlights',
      memory_trail: 'ceremony',
    })
  })

  it('recovers a null message when the data layer used the frozen fallbacks', () => {
    const record = toFilmGuestUploadRecord(fallbackHighlight())
    expect(record.message).toBeNull()
  })
})

describe('film-clips adapter: highlight rows → clip view models', () => {
  it('preserves order, title, description, badge and trail label', () => {
    const clips = mapFilmHighlightsToGuestClips([highlight(), fallbackHighlight()])

    expect(clips).toHaveLength(2)
    expect(clips[0]).toMatchObject({
      id: 'upload-1-0',
      uploadId: 'upload-1',
      guestName: 'Jamie Rivera',
      title: 'Right after the toasts',
      description: 'Right after the toasts',
      videoUrl: 'https://cdn.example.com/clip-1.mp4',
      createdAt: '2025-05-11T10:00:00.000Z',
      badge: FILM_GUEST_CLIP_BADGE,
      trail: 'Ceremony',
    })
    // Fallback description/trail survive the round-trip unchanged.
    expect(clips[1]).toMatchObject({
      id: 'upload-2-1',
      title: 'A moment from Morgan Lee',
      description: FILM_GUEST_CLIP_DEFAULT_DESCRIPTION,
      trail: FILM_GUEST_CLIP_DEFAULT_TRAIL,
    })
  })

  it('caps at the frozen limit of six clips', () => {
    const highlights = Array.from({ length: 7 }, (_, index) =>
      highlight({ id: `upload-${index}-0`, uploadId: `upload-${index}` })
    )

    const clips = mapFilmHighlightsToGuestClips(highlights)

    expect(clips).toHaveLength(FILM_GUEST_CLIP_LIMIT)
    expect(clips.map(clip => clip.uploadId)).toEqual([
      'upload-0',
      'upload-1',
      'upload-2',
      'upload-3',
      'upload-4',
      'upload-5',
    ])
  })

  it('returns empty for an empty data-layer read', () => {
    expect(mapFilmHighlightsToGuestClips([])).toEqual([])
  })
})

describe('film-clips adapter: selection contract guard', () => {
  it('keeps only approved rows', () => {
    const clips = selectFilmClipsFromUploadRecords([
      uploadRecord({ id: 'approved' }),
      uploadRecord({ id: 'pending', status: 'pending' }),
      uploadRecord({ id: 'rejected', status: 'rejected' }),
    ])

    expect(clips.map(clip => clip.uploadId)).toEqual(['approved'])
  })

  it('excludes rows without a video and archive-only rows', () => {
    const clips = selectFilmClipsFromUploadRecords([
      uploadRecord({ id: 'video' }),
      uploadRecord({ id: 'no-video', video_urls: [] }),
      uploadRecord({ id: 'archive', video_visibility: 'archive_only' }),
    ])

    expect(clips.map(clip => clip.uploadId)).toEqual(['video'])
  })

  it('prioritises featured/guest-highlights rows and then preserves order', () => {
    const clips = selectFilmClipsFromUploadRecords([
      uploadRecord({ id: 'regular-1', video_visibility: null }),
      uploadRecord({ id: 'featured', video_visibility: 'featured' }),
      uploadRecord({ id: 'regular-2', video_visibility: null }),
      uploadRecord({ id: 'highlights', video_visibility: 'guest_highlights' }),
    ])

    expect(clips.map(clip => clip.uploadId)).toEqual([
      'featured',
      'highlights',
      'regular-1',
      'regular-2',
    ])
  })
})

describe('fetchFilmGuestClips', () => {
  it('loads highlights through the injected loader and maps them', async () => {
    const loader = vi.fn(() => Promise.resolve([highlight()]))

    const clips = await fetchFilmGuestClips(loader)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(clips).toHaveLength(1)
    expect(clips[0]?.videoUrl).toBe('https://cdn.example.com/clip-1.mp4')
  })

  it('returns empty when the read returns no approved video highlights', async () => {
    expect(await fetchFilmGuestClips(() => Promise.resolve([]))).toEqual([])
  })

  it('propagates read failures so the hook can keep the section hidden', async () => {
    await expect(
      fetchFilmGuestClips(() => Promise.reject(new Error('data layer offline')))
    ).rejects.toThrow('data layer offline')
  })
})
