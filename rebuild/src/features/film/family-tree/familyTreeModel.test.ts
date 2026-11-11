import { describe, expect, it } from 'vitest'
import { WEDDING_PARTY } from '../filmContent'
import { allPartyPeople, chunkRows, orderBridesmaids, orderCouple } from './familyTreeModel'

describe('chunkRows', () => {
  it('matches the frozen row layouts for 7, 6, 5 and fallback sizes', () => {
    const seven = chunkRows(WEDDING_PARTY.bridesmaids)
    expect(seven.map(row => row.length)).toEqual([2, 3, 2])

    const six = chunkRows(WEDDING_PARTY.bridesmaids.slice(0, 6))
    expect(six.map(row => row.length)).toEqual([3, 3])

    const five = chunkRows(WEDDING_PARTY.bridesmaids.slice(0, 5))
    expect(five.map(row => row.length)).toEqual([2, 3])

    const four = chunkRows(WEDDING_PARTY.bridesmaids.slice(0, 4))
    expect(four.map(row => row.length)).toEqual([2, 2])
  })

  it('preserves the input order inside each row', () => {
    const rows = chunkRows(WEDDING_PARTY.bridesmaids)
    expect(rows.flat().map(person => person.id)).toEqual(
      WEDDING_PARTY.bridesmaids.map(person => person.id)
    )
  })
})

describe('orderCouple', () => {
  it('places the bride first and the groom second regardless of source order', () => {
    const reversed = [...WEDDING_PARTY.couple].reverse()
    expect(orderCouple(reversed).map(person => person.name)).toEqual(['Jordyn', 'Austin'])
  })
})

describe('orderBridesmaids', () => {
  it('pins Maria then Lexi before the remaining bridesmaids', () => {
    const ordered = orderBridesmaids()
    expect(ordered[0]?.id).toBe('bm3')
    expect(ordered[1]?.id).toBe('moh')
    expect(ordered).toHaveLength(WEDDING_PARTY.bridesmaids.length)
    expect(new Set(ordered.map(person => person.id)).size).toBe(ordered.length)
  })
})

describe('allPartyPeople', () => {
  it('returns every party member exactly once', () => {
    const people = allPartyPeople()
    expect(people).toHaveLength(20)
    expect(new Set(people.map(person => person.id)).size).toBe(20)
    expect(people.some(person => person.fullName === 'Austin Porada')).toBe(true)
  })
})
