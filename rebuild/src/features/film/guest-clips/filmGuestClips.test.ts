import { describe, expect, it } from 'vitest'
import {
  FILM_GUEST_CLIP_BADGE,
  FILM_GUEST_CLIP_DEFAULT_DESCRIPTION,
  FILM_GUEST_CLIP_DEFAULT_TRAIL,
  selectFilmGuestClips,
  toFilmGuestClip,
  type FilmGuestUploadRecord,
} from './filmGuestClips'

function record(overrides: Partial<FilmGuestUploadRecord> = {}): FilmGuestUploadRecord {
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

describe('toFilmGuestClip', () => {
  it('maps an approved upload with a video to the card view model', () => {
    expect(toFilmGuestClip(record())).toEqual({
      id: 'upload-1',
      uploadId: 'upload-1',
      guestName: 'Jamie Rivera',
      title: 'Our table, right after the toasts.',
      description: 'Our table, right after the toasts.',
      videoUrl: 'https://cdn.example.com/clip-1.mp4',
      createdAt: '2025-05-11T10:00:00.000Z',
      badge: FILM_GUEST_CLIP_BADGE,
      trail: 'Ceremony',
    })
  })

  it('excludes archive-only rows, non-approved rows and rows without a video', () => {
    expect(toFilmGuestClip(record({ video_visibility: 'archive_only' }))).toBeNull()
    expect(toFilmGuestClip(record({ status: 'pending' }))).toBeNull()
    expect(toFilmGuestClip(record({ video_urls: [] }))).toBeNull()
    expect(toFilmGuestClip(record({ video_urls: null }))).toBeNull()
  })

  it('falls back to generated title/description and the default trail label', () => {
    const clip = toFilmGuestClip(
      record({ message: '   ', video_visibility: 'archive?', memory_trail: 'unknown-trail' })
    )

    expect(clip?.title).toBe('A moment from Jamie Rivera')
    expect(clip?.description).toBe(FILM_GUEST_CLIP_DEFAULT_DESCRIPTION)
    expect(clip?.trail).toBe(FILM_GUEST_CLIP_DEFAULT_TRAIL)
  })
})

describe('selectFilmGuestClips', () => {
  it('keeps at most six clips and prioritises featured/guest-highlights rows', () => {
    const uploads = [
      record({ id: 'regular-1', video_visibility: 'standard' }),
      record({ id: 'featured-1', video_visibility: 'featured' }),
      record({ id: 'regular-2', video_visibility: null }),
      record({ id: 'highlights-1', video_visibility: 'guest_highlights' }),
      record({ id: 'regular-3', video_visibility: 'standard' }),
      record({ id: 'regular-4', video_visibility: 'standard' }),
      record({ id: 'regular-5', video_visibility: 'standard' }),
    ]

    const clips = selectFilmGuestClips(uploads)

    expect(clips).toHaveLength(6)
    expect(clips.slice(0, 2).map(clip => clip.uploadId)).toEqual(['featured-1', 'highlights-1'])
    expect(clips.map(clip => clip.uploadId)).not.toContain('regular-5')
    // Frozen id shape: `${upload.id}-${index}` in the selected order.
    expect(clips[0]?.id).toBe('featured-1-0')
  })

  it('filters ineligible rows before counting toward the limit', () => {
    const uploads = [
      record({ id: 'archive', video_visibility: 'archive_only' }),
      record({ id: 'pending', status: 'pending' }),
      record({ id: 'no-video', video_urls: [] }),
      record({ id: 'good' }),
    ]

    expect(selectFilmGuestClips(uploads).map(clip => clip.uploadId)).toEqual(['good'])
  })

  it('returns an empty list when nothing is eligible (section self-hides)', () => {
    expect(selectFilmGuestClips([])).toEqual([])
    expect(selectFilmGuestClips([record({ status: 'rejected' })])).toEqual([])
  })
})
