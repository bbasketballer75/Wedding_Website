/**
 * Deterministic Guest Photos fixtures.
 *
 * Mirrors `contracts/fixtures/guestUploads.json` ("approved") so the Wave-6 page
 * renders the exact text captured in
 * `contracts/content/rendered/guest-photos.json`:
 *
 *   stats:   2 approved uploads / 4 guest photos
 *   cards:   Jamie Rivera (May 11, 2025 · 3 photos) then Morgan Lee (1 photo)
 *   thumbs:  PoradaProposal-29, -11, -150, -181 (first 4 of the 4 photos)
 *
 * Order matters: the frozen page renders API order (no client sort), and the
 * captured oracle order is the fixture order (Jamie first).
 *
 * TODO(Wave3): delete this module when `useGuestPhotosData` is wired to
 * `shared/data/guestUploads.ts` (`fetchApprovedGuestUploads` + `mapGuestUploadRow`).
 */
import type { GuestPhotoUpload } from './types'

export const GUEST_PHOTOS_APPROVED_FIXTURE: GuestPhotoUpload[] = [
  {
    id: 'upload-approved-1',
    guestName: 'Jamie Rivera',
    message: 'So glad we were there — what a beautiful day!',
    photoUrls: [
      '/images/engagement/PoradaProposal-29.webp',
      '/images/engagement/PoradaProposal-11.webp',
      '/images/engagement/PoradaProposal-150.webp',
    ],
    status: 'approved',
    createdAt: '2025-05-11T10:00:00.000Z',
  },
  {
    id: 'upload-approved-2',
    guestName: 'Morgan Lee',
    message: 'Caught some candid moments from our table.',
    photoUrls: ['/images/engagement/PoradaProposal-181.webp'],
    status: 'approved',
    createdAt: '2025-05-11T12:30:00.000Z',
  },
]

/** Pending uploads from the same contract fixture (filtering tests only). */
export const GUEST_PHOTOS_UNAPPROVED_FIXTURE: GuestPhotoUpload[] = [
  {
    id: 'upload-pending-1',
    guestName: 'Riley Thompson',
    message: 'Captured a few special moments from our table!',
    photoUrls: [
      '/images/engagement/PoradaProposal-29.webp',
      '/images/engagement/PoradaProposal-11.webp',
    ],
    status: 'pending',
    createdAt: '2025-05-11T09:00:00.000Z',
  },
  {
    id: 'upload-rejected-1',
    guestName: 'Sam Garcia',
    message: 'Love these photos from the reception!',
    photoUrls: ['/images/engagement/PoradaProposal-150.webp'],
    status: 'rejected',
    createdAt: '2025-05-11T10:30:00.000Z',
  },
]

/** Fresh copies so tests/consumers can never mutate shared fixture state. */
export function cloneUploads(uploads: readonly GuestPhotoUpload[]): GuestPhotoUpload[] {
  return uploads.map(upload => ({ ...upload, photoUrls: [...upload.photoUrls] }))
}

export function createGuestPhotosFixture(): GuestPhotoUpload[] {
  return cloneUploads(GUEST_PHOTOS_APPROVED_FIXTURE)
}

export function createMixedStatusFixture(): GuestPhotoUpload[] {
  return cloneUploads([...GUEST_PHOTOS_APPROVED_FIXTURE, ...GUEST_PHOTOS_UNAPPROVED_FIXTURE])
}
