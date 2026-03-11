export interface FilmChapter {
  label: string
  time: number
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

export const familyFilms = [
  {
    id: 'mom',
    label: 'A Message from Mom',
    duration: '5:09',
    thumbnail: '/images/parents/heather.webp',
  },
  {
    id: 'christine',
    label: "Christine's Toast",
    duration: '4:36',
    thumbnail: '/images/parents/christine.webp',
  },
  {
    id: 'jerame',
    label: "Jerame's Words",
    duration: '4:11',
    thumbnail: '/images/parents/jerame.webp',
  },
  {
    id: 'melony',
    label: "Melony's Message",
    duration: '4:00',
    thumbnail: '/images/parents/melony.webp',
  },
] as const

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
  const response = await fetch('/video/main-film-chapters.vtt')

  if (!response.ok) {
    throw new Error(`Unable to load main film chapters: ${response.status}`)
  }

  const text = await response.text()
  const parsed = parseMainFilmChapters(text)

  return parsed.length > 0 ? parsed : MAIN_FILM_CHAPTERS_FALLBACK
}
