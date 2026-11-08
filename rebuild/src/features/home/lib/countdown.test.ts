import { describe, expect, it } from 'vitest'
import {
  formatAnniversaryNumber,
  getCountdownToNextAnniversary,
  getElapsedTime,
  isDaysBeforeAnniversary,
} from './countdown'

describe('countdown helpers (frozen AnniversaryCountdown semantics)', () => {
  it('counts down to the next anniversary from the current year', () => {
    const units = getCountdownToNextAnniversary(new Date('2026-05-01T12:00:00-04:00'))

    expect(units).toEqual([
      { value: 8, label: 'days' },
      { value: 12, label: 'hours' },
      { value: 0, label: 'minutes' },
      { value: 0, label: 'seconds' },
    ])
  })

  it('rolls to next year once the anniversary instant has passed', () => {
    const units = getCountdownToNextAnniversary(new Date('2026-05-10T12:00:00-04:00'))

    expect(units[0]?.value).toBe(364)
  })

  it('uses singular labels for a value of one', () => {
    const units = getCountdownToNextAnniversary(new Date('2026-05-09T00:00:00-04:00'))

    expect(units).toEqual([
      { value: 1, label: 'day' },
      { value: 0, label: 'hours' },
      { value: 0, label: 'minutes' },
      { value: 0, label: 'seconds' },
    ])
  })

  it('matches the frozen elapsed calculation at the parity clock instant', () => {
    // contracts/ui.json fixedNow = 2026-11-08T17:00:00Z (12:00 America/New_York).
    expect(getElapsedTime(new Date('2026-11-08T17:00:00.000Z'))).toEqual({
      years: 1,
      days: 181,
    })
  })

  it('reports the wedding day itself as zero elapsed time', () => {
    expect(getElapsedTime(new Date('2025-05-10T17:00:00-05:00'))).toEqual({ years: 0, days: 0 })
  })

  it('only shows the countdown inside the frozen 30-day window', () => {
    expect(isDaysBeforeAnniversary(new Date('2026-04-20T12:00:00-04:00'))).toBe(true)
    expect(isDaysBeforeAnniversary(new Date('2026-05-05T12:00:00-04:00'))).toBe(true)
    expect(isDaysBeforeAnniversary(new Date('2026-04-01T12:00:00-04:00'))).toBe(false)
    // The anniversary instant itself is outside the "before" window (frozen <=).
    expect(isDaysBeforeAnniversary(new Date('2026-05-10T12:00:00-04:00'))).toBe(false)
  })

  it('formats the frozen ordinal anniversary labels', () => {
    expect(formatAnniversaryNumber(1)).toBe('1st')
    expect(formatAnniversaryNumber(2)).toBe('2nd')
    expect(formatAnniversaryNumber(3)).toBe('3rd')
    expect(formatAnniversaryNumber(4)).toBe('4th')
    expect(formatAnniversaryNumber(11)).toBe('11th')
  })
})
