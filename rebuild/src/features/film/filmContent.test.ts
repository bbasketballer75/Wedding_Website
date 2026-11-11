import { describe, expect, it } from 'vitest'
import {
  FAMILY_FILMS,
  MAIN_FILM,
  MAIN_FILM_CHAPTERS_FALLBACK,
  MAIN_FILM_RUNTIME_LABEL,
  MEMORY_TRAILS,
  WEDDING_PARTY,
  getMemoryTrailById,
} from './filmContent'

/**
 * Guards the page against the content contract drifting: these are the exact
 * values the frozen Film page rendered (contracts/content/film.json) and the
 * ten-chapter fallback A4 §7 requires.
 */
describe('filmContent contract wiring', () => {
  it('exposes the frozen main-film runtime and media paths', () => {
    expect(MAIN_FILM_RUNTIME_LABEL).toBe('45:53')
    expect(MAIN_FILM).toEqual({
      runtimeLabel: '45:53',
      videoSrc: '/video/main.mp4',
      captionsSrc: '/video/main.vtt',
      poster: '/images/film/main-film-poster.png',
      chaptersSource: '/video/main-film-chapters.vtt',
    })
  })

  it('keeps all ten fallback chapters in order', () => {
    expect(MAIN_FILM_CHAPTERS_FALLBACK).toHaveLength(10)
    expect(MAIN_FILM_CHAPTERS_FALLBACK.map(chapter => chapter.label)).toEqual([
      'Start',
      'Bachelor+ette',
      '"Who Is It"',
      'Wedding Party',
      'Our Vows',
      'The Ceremony',
      'The Reception',
      'First Dance',
      'Bloopers',
      'The Party',
    ])
    expect(MAIN_FILM_CHAPTERS_FALLBACK[0]?.time).toBe(0)
    expect(MAIN_FILM_CHAPTERS_FALLBACK[9]?.time).toBe(2375.12)
  })

  it('keeps the four parent-dance family films with captions and preview frames', () => {
    expect(FAMILY_FILMS.map(film => film.id)).toEqual(['mom', 'melony', 'christine', 'jerame'])
    expect(FAMILY_FILMS.map(film => film.duration)).toEqual(['5:09', '4:00', '4:36', '4:11'])

    for (const film of FAMILY_FILMS) {
      expect(film.videoSrc).toMatch(/^\/video\/[a-z]+\.mp4$/)
      expect(film.captionsSrc).toMatch(/^\/video\/[a-z]+\.vtt$/)
      expect(film.thumbnail).toMatch(/^\/images\/parent-film-cards\/[a-z]+\.webp$/)
      expect(film.previewFrameTimestamps).toHaveLength(4)
    }
  })

  it('resolves memory-trail labels and returns null for unknown ids', () => {
    expect(MEMORY_TRAILS.map(trail => trail.id)).toEqual([
      'ceremony',
      'family',
      'dance-floor',
      'engagement-season',
      'bach-ette',
    ])
    expect(getMemoryTrailById('ceremony')?.label).toBe('Ceremony')
    expect(getMemoryTrailById('nope')).toBeNull()
    expect(getMemoryTrailById(null)).toBeNull()
  })

  it('keeps all 20 wedding-party members with their sides and portraits', () => {
    const people = [
      ...WEDDING_PARTY.couple,
      ...WEDDING_PARTY.parents,
      ...WEDDING_PARTY.bridesmaids,
      ...WEDDING_PARTY.groomsmen,
    ]

    expect(people).toHaveLength(20)
    expect(new Set(people.map(person => person.id)).size).toBe(20)
    expect(WEDDING_PARTY.couple.map(person => person.name)).toEqual(['Austin', 'Jordyn'])
    expect(WEDDING_PARTY.parents).toHaveLength(4)
    expect(WEDDING_PARTY.bridesmaids).toHaveLength(7)
    expect(WEDDING_PARTY.groomsmen).toHaveLength(7)
    expect(people.every(person => person.image.startsWith('/images/'))).toBe(true)
    expect(people.every(person => person.side === 'bride' || person.side === 'groom')).toBe(true)
  })
})
