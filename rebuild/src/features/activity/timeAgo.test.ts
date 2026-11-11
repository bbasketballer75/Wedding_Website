import { describe, expect, it } from 'vitest'
import { ACTIVITY_FIXED_NOW } from './constants'
import { differenceInMonthsUtc, formatActivityTime } from './timeAgo'

const NOW = new Date(ACTIVITY_FIXED_NOW)

/**
 * Every expected string below was produced by the frozen app's formatter:
 * `formatDistance(new Date(createdAt), new Date(fixedNow), { addSuffix: true })`
 * from date-fns v4.4 (the version the frozen app ships). The fixture dates are
 * the parity fixtures, so "over 1 year ago" is load-bearing for text parity.
 */
describe('formatActivityTime', () => {
  it('matches date-fns for the parity fixture timestamps', () => {
    expect(formatActivityTime('2025-05-10T14:00:00.000Z', NOW)).toBe('over 1 year ago')
    expect(formatActivityTime('2025-05-12T18:00:00.000Z', NOW)).toBe('over 1 year ago')
  })

  it('matches the frozen minute/hour buckets', () => {
    expect(formatActivityTime('2026-11-08T16:59:31.000Z', NOW)).toBe('less than a minute ago')
    expect(formatActivityTime('2026-11-08T16:59:00.000Z', NOW)).toBe('1 minute ago')
    expect(formatActivityTime('2026-11-08T16:30:00.000Z', NOW)).toBe('30 minutes ago')
    expect(formatActivityTime('2026-11-08T16:20:00.000Z', NOW)).toBe('40 minutes ago')
    expect(formatActivityTime('2026-11-08T15:40:00.000Z', NOW)).toBe('about 1 hour ago')
    expect(formatActivityTime('2026-11-08T12:00:00.000Z', NOW)).toBe('about 5 hours ago')
  })

  it('matches the frozen day/month/year buckets', () => {
    expect(formatActivityTime('2026-11-07T18:00:00.000Z', NOW)).toBe('about 23 hours ago')
    expect(formatActivityTime('2026-11-07T11:00:00.000Z', NOW)).toBe('1 day ago')
    expect(formatActivityTime('2026-11-05T17:00:00.000Z', NOW)).toBe('3 days ago')
    expect(formatActivityTime('2026-10-08T17:00:00.000Z', NOW)).toBe('about 1 month ago')
    expect(formatActivityTime('2026-09-19T17:00:00.000Z', NOW)).toBe('about 2 months ago')
    expect(formatActivityTime('2026-09-08T17:00:00.000Z', NOW)).toBe('2 months ago')
    expect(formatActivityTime('2026-08-30T17:00:00.000Z', NOW)).toBe('2 months ago')
    expect(formatActivityTime('2026-02-08T17:00:00.000Z', NOW)).toBe('9 months ago')
    expect(formatActivityTime('2024-01-01T00:00:00.000Z', NOW)).toBe('almost 3 years ago')
    expect(formatActivityTime('2021-06-01T00:00:00.000Z', NOW)).toBe('over 5 years ago')
  })

  it('renders future timestamps with the "in" prefix like addSuffix', () => {
    expect(formatActivityTime('2026-11-08T18:00:00.000Z', NOW)).toBe('in about 1 hour')
    expect(formatActivityTime('2026-11-11T17:00:00.000Z', NOW)).toBe('in 3 days')
  })

  it('handles the exact-now and invalid/missing cases', () => {
    expect(formatActivityTime('2026-11-08T17:00:00.000Z', NOW)).toBe('less than a minute ago')
    expect(formatActivityTime(null, NOW)).toBe('')
    expect(formatActivityTime(undefined, NOW)).toBe('')
    expect(formatActivityTime('not-a-date', NOW)).toBe('')
    expect(formatActivityTime('2025-05-10T14:00:00.000Z', new Date(Number.NaN))).toBe('')
  })

  it('counts whole calendar months (date-fns differenceInMonths semantics)', () => {
    const later = new Date('2026-11-08T17:00:00.000Z')
    expect(differenceInMonthsUtc(later, new Date('2025-05-10T14:00:00.000Z'))).toBe(17)
    // Exact month boundary in UTC: the fixture timezone is not part of the input.
    expect(differenceInMonthsUtc(later, new Date('2025-08-08T17:00:00.000Z'))).toBe(15)
    expect(differenceInMonthsUtc(later, new Date('2026-10-08T17:00:00.000Z'))).toBe(1)
    expect(differenceInMonthsUtc(later, new Date('2026-11-01T00:00:00.000Z'))).toBe(0)
  })
})
