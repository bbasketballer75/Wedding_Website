export interface EngagementPhoto {
  id: number
  src: string
  caption: string
  type: 'main' | 'filler' | 'gallery'
  objectPosition?: string
}

export interface StoryContent {
  chapter: string
  title: string
  subtitle: string
  date: string
  text: string[]
  finale: string
  footer: string
}

// Specific known photos (Main & Secondary)
const mainPhotoFilename = 'PoradaProposal-29.webp'
const secondaryPhotoFilename = 'PoradaProposal-58.webp'

// Manually shuffled subset (simulated random order)
const shuffledFiles = [
  'PoradaProposal-318.webp',
  'PoradaProposal-31.webp',
  'PoradaProposal-277.webp',
  'PoradaProposal-156.webp',
  'PoradaProposal-62.webp',
  'PoradaProposal-286.webp',
  'PoradaProposal-40.webp',
  'PoradaProposal-255.webp',
  'PoradaProposal-320.webp',
  'PoradaProposal-262.webp',
  'PoradaProposal-375.webp',
  'PoradaProposal-198.webp',
  'PoradaProposal-259.webp',
  'PoradaProposal-482.webp',
  'PoradaProposal-150.webp',
  'PoradaProposal-181.webp',
  'PoradaProposal-421.webp',
  'PoradaProposal-268.webp',
  'PoradaProposal-11.webp',
  'PoradaProposal-310.webp',
  'PoradaProposal-75.webp',
  'PoradaProposal-146.webp',
  'PoradaProposal-36.webp',
  'PoradaProposal-28.webp',
  'PoradaProposal-316.webp',
  'PoradaProposal-359.webp',
  'PoradaProposal-4.webp',
  'PoradaProposal-6.webp',
  'PoradaProposal-458.webp',
  'PoradaProposal-273.webp',
  'PoradaProposal-309.webp',
  'PoradaProposal-78.webp',
  'PoradaProposal-67.webp',
]

// Construct the export
export const photos: EngagementPhoto[] = [
  // 1. Main Photo
  {
    id: 4,
    src: `/images/engagement/${mainPhotoFilename}`,
    caption: '',
    type: 'main',
  },
  // 2. Secondary Photo
  {
    id: 5,
    src: `/images/engagement/${secondaryPhotoFilename}`,
    caption: '',
    type: 'filler',
  },
  // 3. Shuffled Gallery Photos
  ...shuffledFiles.map((filename, index) => ({
    id: 100 + index,
    src: `/images/engagement/${filename}`,
    caption: '',
    type: 'gallery' as const,
  })),
]

export const storyContent: StoryContent = {
  chapter: 'CHAPTER II',
  title: 'The Proposal',
  subtitle: 'October 31st, 2022 • A Spooky Surprise at Home',
  date: 'October 31st, 2022',
  text: [
    'It was a crisp autumn evening at the Porada Farm, surrounded by the warmth of family and the glow of pumpkins.',
    'Under the guise of a Halloween costume party, a special surprise was being planned. The atmosphere was filled with laughter and spooky festivities.',
    'As the evening sun set and the moon rose, the moment arrived. Surrounded by loved ones and the magic of the season, a question was asked that would begin a new chapter.',
  ],
  finale: 'And she said yes!',
  footer: 'Forever & Always',
}
