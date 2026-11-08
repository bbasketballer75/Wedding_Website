/**
 * Deterministic Guest Share fixtures.
 *
 * Matches `contracts/content/rendered/guest-token.json` exactly:
 *   identity:  "Jane Miller" → "Jane Miller's Showcase"
 *   stats:     6 Photos Shared · 3 Messages Written
 *   photos:    photos.json rows 1-6 in order (captions + likes are the oracle's)
 *   notes:     the three mocked guestbook fixture rows (the capture's mocked
 *              `/guestbook_messages` response), which is why the count is 3
 *
 * TODO(Wave3): delete this module when `useGuestShareAlbum` is wired to
 * `shared/data/claims.ts` (`fetchGuestContributionsByToken`).
 */
import type { GuestShareAlbum, GuestSharePhoto } from './types'

function photo(id: string, file: string, caption: string, likes: number): GuestSharePhoto {
  const url = `/images/engagement/${file}.webp`
  return { id, url, thumbnail: url, caption, likes }
}

export const GUEST_SHARE_ALBUM_FIXTURE: GuestShareAlbum = {
  guestName: 'Jane Miller',
  photos: [
    photo('photo-1', 'PoradaProposal-29', 'First look on the lawn', 24),
    photo('photo-2', 'PoradaProposal-11', 'Walking toward the ceremony garden', 58),
    photo('photo-3', 'PoradaProposal-150', 'Quiet vows before the applause', 42),
    photo('photo-4', 'PoradaProposal-181', 'The first kiss', 89),
    photo('photo-5', 'PoradaProposal-255', 'A table full of laughter', 36),
    photo('photo-6', 'PoradaProposal-277', 'First dance under the lights', 67),
  ],
  notes: [
    {
      id: 'message-1',
      name: 'Sarah Mitchell',
      content:
        'Your vows made the whole room disappear for a second. It felt like all of us were holding our breath with you.',
      createdAt: '2025-05-12T18:00:00.000Z',
    },
    {
      id: 'message-2',
      name: 'Mike Chen',
      content: 'The dance floor was wild in the best way possible.',
      createdAt: '2025-05-13T18:00:00.000Z',
    },
    {
      id: 'message-3',
      name: 'Aunt Patricia',
      content: 'We sent a quick video hello from our table right after the toasts.',
      createdAt: '2025-05-14T18:00:00.000Z',
    },
  ],
}

export function cloneAlbum(album: GuestShareAlbum): GuestShareAlbum {
  return {
    guestName: album.guestName,
    photos: album.photos.map(photo => ({ ...photo })),
    notes: album.notes.map(note => ({ ...note })),
  }
}

export function createGuestShareAlbumFixture(): GuestShareAlbum {
  return cloneAlbum(GUEST_SHARE_ALBUM_FIXTURE)
}

/** Notes-only album: drives the frozen tab auto-switch (photos empty). */
export function createNotesOnlyAlbum(): GuestShareAlbum {
  return {
    guestName: 'Jane Miller',
    photos: [],
    notes: GUEST_SHARE_ALBUM_FIXTURE.notes.map(note => ({ ...note })),
  }
}

/** Photos-only album: proves the auto-switch does not fire when photos exist. */
export function createPhotosOnlyAlbum(): GuestShareAlbum {
  return {
    guestName: 'Jane Miller',
    photos: GUEST_SHARE_ALBUM_FIXTURE.photos.map(photo => ({ ...photo })),
    notes: [],
  }
}

/** Duplicate rows for the merge/dedupe test (first occurrence wins). */
export function createDuplicatePhotoAlbum(): GuestShareAlbum {
  const photos = GUEST_SHARE_ALBUM_FIXTURE.photos
  const first = photos[0]
  if (!first) throw new Error('Guest share fixture is missing its first photo')
  return {
    ...cloneAlbum(GUEST_SHARE_ALBUM_FIXTURE),
    photos: [
      first,
      { ...first, caption: 'Duplicate row that must be dropped' },
      ...photos.slice(1),
    ],
  }
}
