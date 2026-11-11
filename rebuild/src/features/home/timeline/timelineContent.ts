/**
 * Frozen LoveTimeline content (`src/components/timeline/LoveTimeline.tsx`
 * lines 18-209): the 9 milestone records, their side/media configuration and
 * the media file lists.
 *
 * The task brief is explicit: live milestone copy stays literal here, exactly
 * as the oracle renders it — `contracts/content/timeline.json` is archival and
 * is NOT what the live page renders, so it is deliberately not used.
 */
export interface TimelineEvent {
  id: string
  date: string
  title: string
  description: string
  location?: string
  side: 'left' | 'right'
  media?: {
    type: 'map' | 'carousel' | 'icon' | 'link'
    config: Record<string, unknown>
  }
}

export const MEDIA_BASE_PATH = '/media/timeline'

export const timelineEvents: TimelineEvent[] = [
  {
    id: '1',
    date: 'Summer 2017',
    title: 'The Meeting',
    description:
      'We met during a summer at work and somehow the ordinary days started feeling a lot less ordinary. It did not take long for us to realize something bigger was beginning.',
    side: 'left',
    media: {
      type: 'icon',
      config: { iconType: 'meeting' },
    },
  },
  {
    id: '2',
    date: 'Summer 2018',
    title: 'First Date',
    description:
      'This was the point where talking turned into choosing each other on purpose. It felt easy, exciting, and like the start of the version of life we actually wanted.',
    side: 'right',
    media: {
      type: 'icon',
      config: { iconType: 'first-date' },
    },
  },
  {
    id: '3',
    date: 'Summer 2019',
    title: 'Moved to Ligonier',
    description:
      'We packed up, landed in Ligonier, and started building a life that finally felt like ours. New town, new routines, same certainty that we were doing it together.',
    location: 'Ligonier, PA',
    side: 'left',
    media: {
      type: 'map',
      config: { location: 'Ligonier, PA', type: 'town' },
    },
  },
  {
    id: '4',
    date: 'Fall 2020',
    title: 'Bought Our First Home',
    description:
      'Keys in hand, we stepped into the first place that was truly ours. It was the beginning of quiet nights, shared projects, and all the little rituals that make a house feel like home.',
    side: 'right',
    media: {
      type: 'map',
      config: { location: 'Our First Home', type: 'home' },
    },
  },
  {
    id: '5',
    date: 'Nov 2020',
    title: 'The Kitties Arrive',
    description:
      'Moira and Stella made the house feel instantly fuller, louder, and more us. Our little family grew by two and never looked back.',
    side: 'left',
    media: {
      type: 'carousel',
      config: {
        folder: 'cats',
        alt: 'Moira and Stella',
        count: 18,
      },
    },
  },
  {
    id: '6',
    date: 'October 31, 2022',
    title: 'The Proposal 💍🎃',
    description:
      'On Halloween night, in full costume and fully committed to the bit, Austin asked the question that changed everything. It was weird, perfect, emotional, and completely us.',
    location: 'Spookiest Night of the Year',
    side: 'right',
    media: {
      type: 'carousel',
      config: {
        folder: 'engagement',
        alt: 'Engagement Photos',
        count: 35,
      },
    },
  },
  {
    id: '7',
    date: 'Aug 2024',
    title: 'Bachelor & Bachelorette',
    description:
      'A full weekend in Pittsburgh with the people who know us best: loud laughs, late nights, and the kind of memories that only happen when everyone shows up big.',
    location: 'Pittsburgh, PA',
    side: 'left',
    media: {
      type: 'carousel',
      config: {
        folder: 'bachelor_ette__1nlhm4u',
        alt: 'Bachelor and Bachelorette Party',
        count: 7,
      },
    },
  },
  {
    id: '8',
    date: 'Feb 2025',
    title: "Jordyn's Bridal Shower",
    description:
      'One of those gentler celebrations we will always remember. It was full of love, stories, and the feeling that the wedding was finally close enough to touch.',
    location: 'The Boulevard Grill',
    side: 'right',
    media: {
      type: 'map',
      config: { location: 'The Boulevard Grill', type: 'town' },
    },
  },
  {
    id: '9',
    date: 'May 10, 2025',
    title: 'We Got Married!',
    description:
      'The day all of these chapters finally met in one room. Surrounded by our people, we said yes again, this time out loud and for good.',
    location: 'The Lodge at Indian Lake',
    side: 'left',
    media: {
      type: 'icon',
      config: { iconType: 'wedding' },
    },
  },
]

// Actual image files by folder
// NOTE: filenames here must exactly match R2 object keys under media/timeline/.
// Ported verbatim from the frozen source so the carousel counts/order match.
export const mediaFiles: Record<string, string[]> = {
  cats: [
    '20210128_150848_4__1r5aqbl.jpg',
    'PXL_20240114_184414874_2__1a7yin.jpg',
    '608763682_1196135159331667_4161914504755009183_n.jpg',
    'PXL_20230825_171945218.jpg',
  ],
  engagement: [
    'PoradaProposal-316.webp',
    'PoradaProposal-458.webp',
    'PoradaProposal-277.webp',
    'PoradaProposal-181.webp',
    'PoradaProposal-6.webp',
    'PoradaProposal-262.webp',
    'PoradaProposal-255.webp',
    'PoradaProposal-146.webp',
  ],
  bachelor_ette__1nlhm4u: [
    '000108.jpg',
    '000407.jpg',
    '000191.jpg',
    '000429.jpg',
    '000198_2.jpg',
    '000106.jpg',
  ],
}

// Valid image extensions
const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.svg']

function isValidImageFile(filename: string): boolean {
  const lowerName = filename.toLowerCase()
  return VALID_IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))
}

/**
 * Port of the frozen `getImagePaths` helper, resolving through the shared media
 * resolver (frozen `getMediaPath` semantics: only CDN prefixes are offloaded,
 * `/media/` included; no rewrites when no media base URL is configured).
 */
export function getImagePaths(
  folder: string,
  count: number,
  getMediaPath: (path: string) => string
): string[] {
  const files = mediaFiles[folder] ?? []
  const imageFiles = files.filter(isValidImageFile)
  return imageFiles
    .slice(0, Math.min(count, imageFiles.length))
    .map(file => getMediaPath(`${MEDIA_BASE_PATH}/${folder}/${file}`))
}
