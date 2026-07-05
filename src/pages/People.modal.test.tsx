/**
 * Tests for PersonPhotoModal — body scroll lock, ARIA semantics, keyboard nav.
 *
 * PersonPhotoModal is tested in isolation via its named export.
 * Heavy dependencies (Supabase, weddingParty data, media utils) are mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// ─── Mocks (must be declared before importing the component) ──────────────────

vi.mock('@/data/weddingParty', () => ({
  partyData: {
    couple: [{ name: 'Austin', fullName: 'Austin Porada', image: '/austin.jpg' }],
    parents: [],
    groomsmen: [],
    bridesmaids: [{ name: 'Jordyn', fullName: 'Jordyn Bask', image: '/jordyn.jpg' }],
  },
}))

vi.mock('@/utils/media', () => ({
  getMediaPath: (url: string) => url,
}))

vi.mock('@/lib/supabase', () => ({
  fetchPhotosWithFaces: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/stores/claimStore', () => ({
  useClaimStore: { getState: () => ({ openWizard: vi.fn() }) },
}))

vi.mock('@/components/gallery/ClaimModal', () => ({ ClaimModal: () => null }))
vi.mock('@/components/seo/SEOHead', () => ({ PeopleSEO: () => null }))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { PersonPhotoModal } from './People'
import type { Photo } from '@/lib/supabase'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PERSON = {
  name: 'Austin Porada',
  photoCount: 5,
  thumbnail: '/thumb.jpg',
  faceX: 0.5,
  faceY: 0.4,
  faceBoxWidth: 0.2,
  curatedPortrait: '/portrait.jpg',
  collections: ['Wedding Day'],
  professionalCount: 4,
  guestCount: 1,
  previewThumbnails: ['/t1.jpg', '/t2.jpg'],
}

const makePhoto = (id: string, faceName: string): Photo => ({
  id,
  url: `/photos/${id}.jpg`,
  thumbnail: `/photos/${id}-thumb.jpg`,
  caption: `Caption for ${id}`,
  album: 'Wedding Day',
  faces: [
    {
      id: `face-${id}`,
      name: faceName,
      x: 50,
      y: 40,
      box: { left: 10, top: 10, width: 20, height: 20 },
    },
  ],
  is_professional: true,
  created_at: '2025-05-10T12:00:00Z',
  tags: [],
  likes: 0,
})

const PHOTOS: Photo[] = [
  makePhoto('p1', 'Austin Porada'),
  makePhoto('p2', 'Austin'), // short alias form
  makePhoto('p3', 'Jordyn Bask'),
]

afterEach(() => {
  cleanup()
  // Ensure scroll lock is always cleaned up between tests
  document.body.style.overflow = ''
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PersonPhotoModal — body scroll lock', () => {
  it('sets body overflow to hidden on mount', () => {
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow on unmount', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })
})

describe('PersonPhotoModal — ARIA semantics', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('has aria-labelledby pointing to the person name', () => {
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const label = labelId ? document.getElementById(labelId) : null
    expect(label?.textContent).toContain('Austin Porada')
  })

  it('renders person name in the header', () => {
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    expect(screen.getByText('Austin Porada')).toBeDefined()
  })
})

describe('PersonPhotoModal — keyboard navigation', () => {
  it('calls onClose when Escape is pressed (no lightbox open)', () => {
    const onClose = vi.fn()
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={onClose} onGoToGallery={vi.fn()} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('PersonPhotoModal — photo filtering', () => {
  it('shows photos tagged with full name', () => {
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    // p1 is tagged "Austin Porada" and p2 is tagged "Austin" (the short alias)
    // Both should appear; p3 (Jordyn Bask) should not
    expect(screen.getByText('Caption for p1')).toBeDefined()
    expect(screen.getByText('Caption for p2')).toBeDefined()
    expect(screen.queryByText('Caption for p3')).toBeNull()
  })

  it('shows photo count in header', () => {
    render(
      <PersonPhotoModal person={PERSON} photos={PHOTOS} onClose={vi.fn()} onGoToGallery={vi.fn()} />
    )
    // 2 photos match Austin Porada (full name + short alias)
    expect(screen.getByText('2 photos')).toBeDefined()
  })
})

describe('FULL_TO_SHORT_ALIASES logic', () => {
  // Verify the alias mapping logic used by PersonPhotoModal, independent of React.
  // This mirrors the FULL_TO_SHORT_ALIASES constant built from partyData.

  function buildReverseAliases(
    people: Array<{ name?: string; fullName?: string }>
  ): Record<string, string> {
    const m: Record<string, string> = {}
    for (const p of people) {
      if (p.name && p.fullName && p.name !== p.fullName) m[p.fullName] = p.name
    }
    return m
  }

  it('maps full name to short alias', () => {
    const aliases = buildReverseAliases([{ name: 'Austin', fullName: 'Austin Porada' }])
    expect(aliases['Austin Porada']).toBe('Austin')
  })

  it('does not add an entry when name equals fullName', () => {
    const aliases = buildReverseAliases([{ name: 'Carol', fullName: 'Carol' }])
    expect(Object.keys(aliases)).toHaveLength(0)
  })

  it('handles multiple people correctly', () => {
    const aliases = buildReverseAliases([
      { name: 'Austin', fullName: 'Austin Porada' },
      { name: 'Jordyn', fullName: 'Jordyn Bask' },
    ])
    expect(aliases['Austin Porada']).toBe('Austin')
    expect(aliases['Jordyn Bask']).toBe('Jordyn')
  })
})
