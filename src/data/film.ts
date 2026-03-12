import { getMediaPath } from '@/utils/media'

export interface FilmChapter {
  label: string
  time: number
}

export interface FamilyFilm {
  id: string
  label: string
  description: string
  duration: string
  thumbnail: string
  videoSrc: string
  previewFrameTimestamps: number[]
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
    thumbnail: '/images/parents/heather.webp',
    videoSrc: '/video/mom.mp4',
    previewFrameTimestamps: [8, 26, 44, 63],
  },
  {
    id: 'christine',
    label: 'Jordyn & Chrintine',
    description: 'Jordyn and Chrintine getting their turn in the spotlight, with the kind of smiles that tell the whole story without a speech.',
    duration: '4:36',
    thumbnail: '/images/parents/christine.webp',
    videoSrc: '/video/christine.mp4',
    previewFrameTimestamps: [7, 22, 39, 55],
  },
  {
    id: 'jerame',
    label: 'Jordyn & Jerame',
    description: 'A father-daughter dance that feels exactly like the heart of the day: proud, emotional, and impossible not to watch all the way through.',
    duration: '4:11',
    thumbnail: '/images/parents/jerame.webp',
    videoSrc: '/video/jerame.mp4',
    previewFrameTimestamps: [6, 19, 34, 48],
  },
  {
    id: 'melony',
    label: 'Austin & Melony',
    description: 'Austin and Melony sharing one of the most personal pauses of the reception before the dance floor opened all the way up again.',
    duration: '4:00',
    thumbnail: '/images/parents/melony.webp',
    videoSrc: '/video/melony.mp4',
    previewFrameTimestamps: [6, 18, 31, 44],
  },
]

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

export async function loadMainFilmChapters() {
  const response = await fetch(getMediaPath('/video/main-film-chapters.vtt'))

  if (!response.ok) {
    throw new Error(`Unable to load main film chapters: ${response.status}`)
  }

  const text = await response.text()
  const parsed = parseMainFilmChapters(text)

  return parsed.length > 0 ? parsed : MAIN_FILM_CHAPTERS_FALLBACK
}
