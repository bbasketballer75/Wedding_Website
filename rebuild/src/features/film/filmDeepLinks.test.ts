import { describe, expect, it } from 'vitest'
import { parseFilmSearch, removeSearchParam, toSearchObject } from './filmDeepLinks'

describe('parseFilmSearch', () => {
  it('parses all three deep-link params', () => {
    expect(parseFilmSearch('?clip=mom&moment=the-ceremony&resume=1')).toEqual({
      clip: 'mom',
      moment: 'the-ceremony',
      resume: true,
    })
  })

  it('treats absent/empty params as null and resume as strictly "1"', () => {
    expect(parseFilmSearch('')).toEqual({ clip: null, moment: null, resume: false })
    expect(parseFilmSearch('?clip=&moment=')).toEqual({ clip: null, moment: null, resume: false })
    expect(parseFilmSearch('?resume=0').resume).toBe(false)
    expect(parseFilmSearch('?resume=true').resume).toBe(false)
  })

  it('ignores unknown params and keeps them for cleanup calculations', () => {
    expect(parseFilmSearch('?utm=share&clip=jerame')).toEqual({
      clip: 'jerame',
      moment: null,
      resume: false,
    })
  })
})

describe('removeSearchParam', () => {
  it('removes only the requested param and preserves the rest', () => {
    expect(removeSearchParam('?clip=mom&moment=the-vows', 'clip')).toBe('?moment=the-vows')
    expect(removeSearchParam('?clip=mom', 'clip')).toBe('')
    expect(removeSearchParam('', 'clip')).toBe('')
  })
})

describe('toSearchObject', () => {
  it('converts a search string into the plain object TanStack Router expects', () => {
    expect(toSearchObject('?moment=first-dance&resume=1')).toEqual({
      moment: 'first-dance',
      resume: '1',
    })
    expect(toSearchObject('')).toEqual({})
  })
})
