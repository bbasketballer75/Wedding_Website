/**
 * Unit tests for the Print page slider and photo-count cap logic.
 *
 * Tests mirror the clamping expressions and totalPhotoCount derivation
 * in Print.tsx without needing to render the component.
 */

import { describe, it, expect } from 'vitest'

// ─── Number input clamp ───────────────────────────────────────────────────────
// Mirrors the onChange handler: Math.max(1, Math.min(500, Number(e.target.value)))

function clampNumberInput(value: number): number {
  return Math.max(1, Math.min(500, value))
}

// ─── totalPhotoCount ──────────────────────────────────────────────────────────
// Mirrors: includedAlbums.reduce((sum, s) => sum + Math.min(s.photos.length, maxPhotosPerAlbum), 0)

function computeTotalPhotoCount(
  albums: Array<{ photosLength: number }>,
  maxPerAlbum: number
): number {
  return albums.reduce((sum, a) => sum + Math.min(a.photosLength, maxPerAlbum), 0)
}

// ─── Overflow counter ─────────────────────────────────────────────────────────
// Mirrors: Math.min(previewThumbnails.length, 4) shown in the photo strip chip.

function overflowCount(totalPhotoCount: number, thumbnailsCollected: number): number {
  const shown = Math.min(thumbnailsCollected, 4)
  return totalPhotoCount > shown ? totalPhotoCount - shown : 0
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Print page — number input clamp (min 1, max 500)', () => {
  it('clamps below minimum up to 1', () => {
    expect(clampNumberInput(0)).toBe(1)
    expect(clampNumberInput(-10)).toBe(1)
  })

  it('clamps above maximum down to 500', () => {
    expect(clampNumberInput(501)).toBe(500)
    expect(clampNumberInput(10000)).toBe(500)
  })

  it('passes through values inside the range unchanged', () => {
    expect(clampNumberInput(1)).toBe(1)
    expect(clampNumberInput(40)).toBe(40)
    expect(clampNumberInput(200)).toBe(200)
    expect(clampNumberInput(500)).toBe(500)
  })

  it('handles non-integer values by clamping after conversion', () => {
    expect(clampNumberInput(0.5)).toBe(1)
    expect(clampNumberInput(500.9)).toBe(500)
  })
})

describe('Print page — totalPhotoCount respects per-album cap', () => {
  it('caps each album at maxPhotosPerAlbum', () => {
    const albums = [{ photosLength: 50 }, { photosLength: 50 }, { photosLength: 50 }]
    expect(computeTotalPhotoCount(albums, 10)).toBe(30)
  })

  it('does not pad when album has fewer photos than cap', () => {
    const albums = [{ photosLength: 5 }, { photosLength: 3 }]
    expect(computeTotalPhotoCount(albums, 100)).toBe(8)
  })

  it('returns 0 for an empty album list', () => {
    expect(computeTotalPhotoCount([], 40)).toBe(0)
  })

  it('returns 0 when cap is 0', () => {
    expect(computeTotalPhotoCount([{ photosLength: 50 }], 0)).toBe(0)
  })

  it('exact cap — album size equals maxPhotosPerAlbum', () => {
    const albums = [{ photosLength: 40 }, { photosLength: 40 }]
    expect(computeTotalPhotoCount(albums, 40)).toBe(80)
  })
})

describe('People card — photo strip overflow counter', () => {
  it('shows no chip when photoCount <= thumbnails shown', () => {
    expect(overflowCount(3, 3)).toBe(0)
    expect(overflowCount(4, 4)).toBe(0)
  })

  it('chips correctly when fewer thumbnails were collected than 4', () => {
    // 6 total photos, but only 3 thumbnails collected → chip says +3 not +2
    expect(overflowCount(6, 3)).toBe(3)
  })

  it('chips correctly when 4 thumbnails are shown', () => {
    expect(overflowCount(10, 4)).toBe(6)
    expect(overflowCount(10, 5)).toBe(6) // only 4 displayed (slice 0,4), same result
  })

  it('returns 0 for empty photo count', () => {
    expect(overflowCount(0, 0)).toBe(0)
  })
})
