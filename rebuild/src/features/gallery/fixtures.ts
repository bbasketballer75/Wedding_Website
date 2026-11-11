import type { GalleryPhoto } from './data'
import { CURATED_PHOTOS } from './curated-photos'

/**
 * Wave-5 gallery fixtures.
 *
 * `CURATED_PHOTOS` is GENERATED from `contracts/content/curated-photos.json`
 * (frozen gallery copy: 35 rows across Proposal/Wedding Photos). Hand-written
 * fixtures drifted from the oracle's captions/counts and broke `/gallery` text
 * parity, so the list is contract-sourced now.
 *
 * `LIVE_PHOTOS` stays as the deterministic stub used by feature tests and the
 * storybook-style previews; the page itself reads live rows through the typed
 * data layer (`app/routes/gallery-data.ts`).
 */
export { CURATED_PHOTOS }

function image(path: string) {
  return { url: path, thumbnail: path, downloadUrl: path }
}

/** Deterministic stub live rows used by feature tests. */
export const LIVE_PHOTOS: GalleryPhoto[] = [
  {
    id: 'photo-1',
    ...image('/images/couple/495660452_23961794676737340_6440789571967380360_n.webp'),
    caption: 'First look on the lawn',
    album: 'Wedding Day',
    category: 'Getting Ready',
    likes: 24,
    aspectRatio: 1.5,
    location: 'The Lodge Lawn',
    photographer: 'Emma Photography',
    date: '2025-05-10T14:00:00.000Z',
    createdAt: '2025-05-10T14:00:00.000Z',
    faces: [
      { id: 'face-1', name: 'Austin Porada', x: 38, y: 42 },
      { id: 'face-2', name: 'Jordyn Porada', x: 62, y: 40 },
    ],
    tags: ['first look', 'lawn', 'portrait'],
    source: 'professional',
    collection: 'Wedding Photos',
    albumSortOrder: 1,
  },
  {
    id: 'photo-2',
    ...image('/images/couple/496093297_9839735762736111_2592755804783153377_n.webp'),
    caption: 'Walking toward the ceremony garden',
    album: 'Wedding Day',
    category: 'Ceremony',
    likes: 58,
    aspectRatio: 1.33,
    location: 'Ceremony Garden',
    photographer: 'Emma Photography',
    date: '2025-05-10T15:30:00.000Z',
    createdAt: '2025-05-10T15:30:00.000Z',
    faces: [{ id: 'face-3', name: 'Jordyn Porada', x: 51, y: 43 }],
    tags: ['ceremony', 'aisle', 'garden'],
    source: 'professional',
    collection: 'Wedding Photos',
    albumSortOrder: 2,
  },
  {
    id: 'photo-3',
    ...image('/images/rings/austins_ring1.webp'),
    caption: 'Rings on the vows page',
    album: 'Rings',
    category: 'Details',
    likes: 17,
    aspectRatio: 1,
    location: 'Ceremony Garden',
    photographer: 'Emma Photography',
    date: '2025-05-10T15:40:00.000Z',
    createdAt: '2025-05-10T15:40:00.000Z',
    faces: [],
    tags: ['rings', 'details', 'vows'],
    source: 'professional',
    collection: 'Wedding Photos',
    albumSortOrder: 3,
  },
  {
    id: 'photo-4',
    ...image('/images/parents/christine.webp'),
    caption: 'Christine before the ceremony',
    album: 'Parents',
    category: 'Family',
    likes: 31,
    aspectRatio: 0.67,
    location: 'The Lodge',
    photographer: 'Emma Photography',
    date: '2025-05-10T16:00:00.000Z',
    createdAt: '2025-05-10T16:00:00.000Z',
    faces: [{ id: 'face-4', name: 'Christine Porada', x: 48, y: 38 }],
    tags: ['parents', 'family', 'portrait'],
    source: 'professional',
    collection: 'Wedding Photos',
    albumSortOrder: 4,
  },
  {
    id: 'photo-5',
    ...image('/images/shared-gallery-new/20250511_180812-0b9c.webp'),
    caption: 'The last dance floor frame',
    album: 'Guest Uploads',
    category: 'Reception',
    likes: 74,
    aspectRatio: 1.5,
    location: 'The Lodge',
    photographer: 'A guest',
    date: '2025-05-11T23:30:00.000Z',
    createdAt: '2025-05-11T23:30:00.000Z',
    faces: [],
    tags: ['dance floor', 'reception', 'guest'],
    source: 'professional',
    collection: 'Wedding Photos',
    albumSortOrder: 5,
  },
]

/** Frozen upload-status fixture shape (`contracts/fixtures/guestUploads.json`). */
export const UPLOAD_STATUS_FIXTURE = {
  guest_name: 'Jamie Rivera',
  guest_email: 'jamie@example.com',
  status: 'approved' as const,
  rejection_reason: null,
  photo_urls: [
    '/images/engagement/PoradaProposal-29.webp',
    '/images/engagement/PoradaProposal-11.webp',
    '/images/engagement/PoradaProposal-150.webp',
  ],
}
