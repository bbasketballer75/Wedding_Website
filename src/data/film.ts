import { getMediaPath } from '@/utils/media'

export interface FilmChapter {
  label: string
  time: number
}

export interface FilmGalleryTarget {
  album: 'Engagement' | 'Bach+ette' | 'Wedding Day' | 'Guest Uploads'
  searchQuery?: string
  person?: string
  ctaLabel?: string
}

export interface FamilyFilm {
  id: string
  label: string
  description: string
  duration: string
  thumbnail: string
  videoSrc: string
  captionsSrc: string
  previewFrameTimestamps: number[]
}

export interface FilmQuote {
  id: string
  quote: string
  speaker: string
  note: string
  time: number
  momentSlug: string
}

export interface FilmWatchPath {
  id: string
  label: string
  description: string
  momentSlug?: string
  clipId?: FamilyFilm['id']
  galleryTarget?: FilmGalleryTarget
}

export const MAIN_FILM_RUNTIME_LABEL = '45:53'

export const MAIN_FILM_CHAPTERS_FALLBACK: FilmChapter[] = [
  { label: 'Start', time: 0 },
  { label: 'Bachelor+ette', time: 44.64 },
  { label: '"Who Is It"', time: 300.44 },
  { label: 'Wedding Party', time: 863.36 },
  { label: 'Our Vows', time: 1211 },
  { label: 'The Ceremony', time: 1537.88 },
  { label: 'The Reception', time: 1688.92 },
  { label: 'First Dance', time: 1814.88 },
  { label: 'Bloopers', time: 2165.28 },
  { label: 'The Party', time: 2375.12 },
]

export const familyFilms: FamilyFilm[] = [
  {
    id: 'mom',
    label: 'Austin & Heather',
    description: 'The mother-son dance from Austin and Heather, full of the warmth and nerves that made the room go quiet for a second.',
    duration: '5:09',
    thumbnail: '/images/parent-film-cards/heather.webp',
    videoSrc: '/video/mom.mp4',
    captionsSrc: '/video/mom.vtt',
    previewFrameTimestamps: [8, 26, 44, 63],
  },
  {
    id: 'melony',
    label: 'Austin & Melony',
    description: 'Austin and Melony sharing one of the most personal pauses of the reception before the dance floor opened all the way up again.',
    duration: '4:00',
    thumbnail: '/images/parent-film-cards/melony.webp',
    videoSrc: '/video/melony.mp4',
    captionsSrc: '/video/melony.vtt',
    previewFrameTimestamps: [6, 18, 31, 44],
  },
  {
    id: 'christine',
    label: 'Jordyn & Christine',
    description: 'Jordyn and Christine getting their turn in the spotlight, with the kind of smiles that tell the whole story without a speech.',
    duration: '4:36',
    thumbnail: '/images/parent-film-cards/christine.webp',
    videoSrc: '/video/christine.mp4',
    captionsSrc: '/video/christine.vtt',
    previewFrameTimestamps: [7, 22, 39, 55],
  },
  {
    id: 'jerame',
    label: 'Jordyn & Jerame',
    description: 'A father-daughter dance that feels exactly like the heart of the day: proud, emotional, and impossible not to watch all the way through.',
    duration: '4:11',
    thumbnail: '/images/parent-film-cards/jerame.webp',
    videoSrc: '/video/jerame.mp4',
    captionsSrc: '/video/jerame.vtt',
    previewFrameTimestamps: [6, 19, 34, 48],
  },
]

export const filmQuotes: FilmQuote[] = [
  {
    id: 'quote-vows',
    quote: 'A promise that lands best when you hear it with the room still quiet around it.',
    speaker: 'Our vows',
    note: 'Start here if you want the emotional center of the day in one jump.',
    time: 1211,
    momentSlug: 'our-vows',
  },
  {
    id: 'quote-ceremony',
    quote: 'The part where everything stopped feeling like planning and started feeling real.',
    speaker: 'Ceremony',
    note: 'For the walk in, the exchange, and the room holding its breath.',
    time: 1537.88,
    momentSlug: 'the-ceremony',
  },
  {
    id: 'quote-first-dance',
    quote: 'A softer beat in the middle of the reception before the floor fully opened up.',
    speaker: 'First dance',
    note: 'The cleanest jump if you want romance before the party blur.',
    time: 1814.88,
    momentSlug: 'first-dance',
  },
  {
    id: 'quote-party',
    quote: 'The exact kind of joyful chaos guests remember best on the drive home.',
    speaker: 'The party',
    note: 'Best for the late-night, loud-table, everybody-on-the-floor version of the day.',
    time: 2375.12,
    momentSlug: 'the-party',
  },
]

export const filmWatchPaths: FilmWatchPath[] = [
  {
    id: 'full-film',
    label: 'Full film',
    description: 'Start at the beginning and let the whole day unfold without skipping ahead.',
    momentSlug: 'start',
    galleryTarget: {
      album: 'Wedding Day',
      ctaLabel: 'Browse wedding day photos',
    },
  },
  {
    id: 'ceremony-only',
    label: 'Ceremony only',
    description: 'Jump right into the walk, vows, and the official heartbeat of the day.',
    momentSlug: 'the-ceremony',
    galleryTarget: {
      album: 'Wedding Day',
      searchQuery: 'ceremony vows',
      ctaLabel: 'Browse ceremony photos',
    },
  },
  {
    id: 'speeches',
    label: 'Speeches',
    description: 'Go straight to the words people still quote back to us.',
    momentSlug: 'the-reception',
    galleryTarget: {
      album: 'Wedding Day',
      searchQuery: 'reception speeches toast',
      ctaLabel: 'Browse speech and reception photos',
    },
  },
  {
    id: 'dancing',
    label: 'Dancing',
    description: 'Start where the floor loosens up and the party starts carrying the night.',
    momentSlug: 'first-dance',
    galleryTarget: {
      album: 'Wedding Day',
      searchQuery: 'first dance dance floor celebration',
      ctaLabel: 'Browse dance floor photos',
    },
  },
  {
    id: 'family-moments',
    label: 'Family moments',
    description: 'Open the parent dances first, then move into the quieter emotional beats.',
    clipId: 'mom',
    galleryTarget: {
      album: 'Wedding Day',
      searchQuery: 'family parents dance portraits',
      ctaLabel: 'Browse family photos',
    },
  },
]

const filmMomentGalleryTargets = new Map<string, FilmGalleryTarget>([
  ['start', { album: 'Wedding Day', ctaLabel: 'Browse the wedding day gallery' }],
  ['bachelor-ette', { album: 'Bach+ette', ctaLabel: 'Browse bach+ette photos' }],
  ['who-is-it', { album: 'Bach+ette', ctaLabel: 'Browse pre-wedding photos' }],
  ['wedding-party', { album: 'Wedding Day', searchQuery: 'wedding party portraits', ctaLabel: 'Browse wedding party photos' }],
  ['our-vows', { album: 'Wedding Day', searchQuery: 'vows ceremony', ctaLabel: 'Browse vows and ceremony photos' }],
  ['the-ceremony', { album: 'Wedding Day', searchQuery: 'ceremony', ctaLabel: 'Browse ceremony photos' }],
  ['the-reception', { album: 'Wedding Day', searchQuery: 'reception speeches toast', ctaLabel: 'Browse reception photos' }],
  ['first-dance', { album: 'Wedding Day', searchQuery: 'first dance', ctaLabel: 'Browse first dance photos' }],
  ['bloopers', { album: 'Guest Uploads', ctaLabel: 'Browse guest uploads' }],
  ['the-party', { album: 'Guest Uploads', searchQuery: 'dance floor party', ctaLabel: 'Browse guest party photos' }],
])

function parseTimecode(value: string) {
  const segments = value.trim().split(':').map((segment) => Number.parseFloat(segment))

  return segments.reduce((total, segment) => total * 60 + segment, 0)
}

export function parseMainFilmChapters(vttText: string): FilmChapter[] {
  return vttText
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .flatMap((lines) => {
      const timeLine = lines.find((line) => line.includes('-->'))
      const labelLine = lines.find((line) => !line.includes('-->') && line !== 'WEBVTT')

      if (!timeLine || !labelLine) {
        return []
      }

      const [start] = timeLine.split('-->')

      return [
        {
          label: labelLine,
          time: parseTimecode(start),
        },
      ]
    })
}

export function slugifyFilmMoment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function loadMainFilmChapters() {
  const response = await fetch(getMediaPath('/video/main-film-chapters.vtt'))

  if (!response.ok) {
    throw new Error(`Unable to load main film chapters: ${response.status}`)
  }

  const text = await response.text()

  // Guard against SPA catch-all returning HTML instead of VTT (e.g. in local preview)
  if (!text.trimStart().startsWith('WEBVTT')) {
    throw new Error('Response is not a valid VTT file')
  }

  const parsed = parseMainFilmChapters(text)

  return parsed.length > 0 ? parsed : MAIN_FILM_CHAPTERS_FALLBACK
}

export function getFilmGalleryTargetByMomentSlug(momentSlug?: string | null) {
  if (!momentSlug) {
    return null
  }

  return filmMomentGalleryTargets.get(momentSlug) ?? null
}
