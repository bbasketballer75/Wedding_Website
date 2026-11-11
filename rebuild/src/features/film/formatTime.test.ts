import { describe, expect, it } from 'vitest'
import { formatChapterTime, formatTime } from './formatTime'

describe('formatTime', () => {
  it('matches the frozen player time display', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(9.9)).toBe('0:09')
    expect(formatTime(75)).toBe('1:15')
    expect(formatTime(3725)).toBe('1:02:05')
  })
})

describe('formatChapterTime', () => {
  it('matches the frozen chapter-guide label (minutes:seconds only)', () => {
    expect(formatChapterTime(0)).toBe('0:00')
    expect(formatChapterTime(44.64)).toBe('0:44')
    expect(formatChapterTime(1537.88)).toBe('25:37')
  })
})
