import type { GalleryPhoto } from './data'

/**
 * Deterministic Wave-5 gallery fixtures.
 *
 * TODO(Wave3): delete this module when `useGalleryPhotos` is wired to the typed
 * `shared/data` gallery hooks. The shapes mirror `contracts/content/curated-photos.json`
 * (curated rows) and `contracts/fixtures/photos.json` (live rows) so the swap is
 * a data-source change, not a component change.
 *
 * Counts on purpose match the frozen rendered oracle for `/gallery`
 * (contracts/content/rendered/gallery.json): 30 Proposal + 5 Wedding Photos,
 * 0 Bach+ette, 0 Guest Photos.
 */

const ENGAGEMENT_IMAGES = [
  'PoradaProposal-29',
  'PoradaProposal-11',
  'PoradaProposal-150',
  'PoradaProposal-181',
  'PoradaProposal-255',
  'PoradaProposal-277',
  'PoradaProposal-310',
  'PoradaProposal-375',
  'PoradaProposal-4',
  'PoradaProposal-6',
  'PoradaProposal-28',
  'PoradaProposal-31',
  'PoradaProposal-36',
  'PoradaProposal-40',
  'PoradaProposal-58',
  'PoradaProposal-62',
  'PoradaProposal-67',
  'PoradaProposal-75',
  'PoradaProposal-78',
  'PoradaProposal-146',
  'PoradaProposal-156',
  'PoradaProposal-198',
  'PoradaProposal-259',
  'PoradaProposal-262',
  'PoradaProposal-268',
  'PoradaProposal-273',
  'PoradaProposal-286',
  'PoradaProposal-309',
  'PoradaProposal-316',
  'PoradaProposal-318',
] as const

const CURATED_CAPTIONS = [
  'The walk into the surprise',
  'A quiet pause before forever',
  'The question already answered in her smile',
  'Portraits in the last light',
  'Laughing between takes',
  'The ring, finally on her hand',
  'Golden hour on the water',
  'A promise made at dusk',
] as const

const CURATED_LOCATIONS = ['Proposal spot', 'The Lodge Lawn', 'Waterfront path'] as const
const PHOTOGRAPHERS = ['Emma Photography', 'Emma Photography', 'The Poradas Archive'] as const
const FACE_SETS: ReadonlyArray<ReadonlyArray<{ id: string; name: string; x: number; y: number }>> =
  [
    [
      { id: 'f1', name: 'Jordyn', x: 40, y: 35 },
      { id: 'f2', name: 'Austin', x: 65, y: 40 },
    ],
    [{ id: 'f3', name: 'Jordyn', x: 50, y: 45 }],
    [{ id: 'f4', name: 'Austin', x: 55, y: 42 }],
  ]

const ASPECT_RATIOS = [1.5, 0.67, 1, 1.33, 0.8, 1.5, 1, 0.67] as const

function image(path: string) {
  return { url: path, thumbnail: path, downloadUrl: path }
}

export const CURATED_PHOTOS: GalleryPhoto[] = ENGAGEMENT_IMAGES.map((name, index) => {
  const path = `/images/engagement/${name}.webp`
  const caption = CURATED_CAPTIONS[index % CURATED_CAPTIONS.length] ?? 'Proposal portrait'
  return {
    id: `curated-${index + 1}`,
    ...image(path),
    caption,
    album: 'Engagement',
    category: 'Proposal',
    likes: 10 + index * 3,
    aspectRatio: ASPECT_RATIOS[index % ASPECT_RATIOS.length] ?? 1,
    time: 'Golden hour',
    location: CURATED_LOCATIONS[index % CURATED_LOCATIONS.length] ?? 'Proposal spot',
    photographer: PHOTOGRAPHERS[index % PHOTOGRAPHERS.length] ?? 'Emma Photography',
    date: '2024-10-31',
    createdAt: `2024-10-31T18:${String(index % 60).padStart(2, '0')}:00`,
    faces: [...(FACE_SETS[index % FACE_SETS.length] ?? [])],
    tags: ['engagement', 'proposal', 'portrait'],
    source: 'professional',
    collection: 'Proposal',
    albumSortOrder: index + 1,
  }
})

/** 5 live wedding-day rows (the oracle's `Wedding Photos` tab count). */
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
