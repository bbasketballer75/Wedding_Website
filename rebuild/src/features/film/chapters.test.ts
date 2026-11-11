import { describe, expect, it, vi } from 'vitest'
import {
  loadMainFilmChapters,
  parseMainFilmChapters,
  parseTimecode,
  slugifyFilmMoment,
} from './chapters'
import { MAIN_FILM_CHAPTERS_FALLBACK } from './filmContent'

const VTT_FIXTURE = [
  'WEBVTT',
  '',
  '00:00.000 --> 00:44.640',
  'Start',
  '',
  '00:44.640 --> 05:00.440',
  'Bachelor+ette',
  '',
  '05:00.440 --> 10:00.000',
  '"Who Is It"',
].join('\n')

function responseWithBody(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response
}

describe('parseTimecode', () => {
  it('parses mm:ss and hh:mm:ss timecodes', () => {
    expect(parseTimecode('00:44.640')).toBeCloseTo(44.64)
    expect(parseTimecode('05:00.440')).toBeCloseTo(300.44)
    expect(parseTimecode('01:02:03.500')).toBeCloseTo(3723.5)
  })
})

describe('parseMainFilmChapters', () => {
  it('parses labels and times and skips the WEBVTT header block', () => {
    expect(parseMainFilmChapters(VTT_FIXTURE)).toEqual([
      { label: 'Start', time: 0 },
      { label: 'Bachelor+ette', time: 44.64 },
      { label: '"Who Is It"', time: 300.44 },
    ])
  })

  it('returns an empty list for a track with no cue blocks', () => {
    expect(parseMainFilmChapters('WEBVTT\n')).toEqual([])
  })
})

describe('slugifyFilmMoment', () => {
  it('matches the frozen slug contract used by ?moment=', () => {
    expect(slugifyFilmMoment('Start')).toBe('start')
    expect(slugifyFilmMoment('Bachelor+ette')).toBe('bachelor-ette')
    expect(slugifyFilmMoment('"Who Is It"')).toBe('who-is-it')
    expect(slugifyFilmMoment('The Ceremony')).toBe('the-ceremony')
  })
})

describe('loadMainFilmChapters', () => {
  it('loads and parses a real WEBVTT chapter track through the media resolver', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(responseWithBody(VTT_FIXTURE)))
    const resolveMediaPath = vi.fn((path: string) => `https://media.test${path}`)

    const chapters = await loadMainFilmChapters({ fetchImpl, resolveMediaPath })

    expect(resolveMediaPath).toHaveBeenCalledWith('/video/main-film-chapters.vtt')
    expect(fetchImpl).toHaveBeenCalledWith('https://media.test/video/main-film-chapters.vtt')
    expect(chapters).toHaveLength(3)
    expect(chapters[1]).toEqual({ label: 'Bachelor+ette', time: 44.64 })
  })

  it('rejects a non-ok response so the caller keeps the fallback chapters', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(responseWithBody('missing', 404)))

    await expect(
      loadMainFilmChapters({ fetchImpl, resolveMediaPath: path => path })
    ).rejects.toThrow('Unable to load main film chapters: 404')
  })

  it('anti-HTML guard: rejects the SPA catch-all HTML body instead of parsing it', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(responseWithBody('<!doctype html><html><body>app shell</body></html>'))
    )

    await expect(
      loadMainFilmChapters({ fetchImpl, resolveMediaPath: path => path })
    ).rejects.toThrow('Response is not a valid VTT file')
  })

  it('falls back to the contract chapters when the VTT parses to no cues', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(responseWithBody('WEBVTT\n')))

    const chapters = await loadMainFilmChapters({ fetchImpl, resolveMediaPath: path => path })

    expect(chapters).toEqual(MAIN_FILM_CHAPTERS_FALLBACK)
  })
})
