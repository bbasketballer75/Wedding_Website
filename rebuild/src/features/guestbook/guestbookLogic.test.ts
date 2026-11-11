import { describe, expect, it } from 'vitest'
import { formatGuestbookDate } from './guestbookText'
import { createRateLimiter, formatTimeRemaining } from './rateLimit'
import {
  getOrCreateReactionFingerprint,
  hasReacted,
  markReacted,
  reactionMarkerKey,
  unmarkReacted,
} from './reactionFingerprint'
import { validateComposerFields } from './data'
import type { GuestbookStorage } from './types'
import { GUESTBOOK_FIXTURE, createStubGuestbookApi, GUESTBOOK_FIXED_NOW } from './data'

function memoryStorage(): GuestbookStorage {
  const store = new Map<string, string>()
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: key => {
      store.delete(key)
    },
  }
}

describe('client submit limiter', () => {
  it('allows 3 submissions per rolling minute and reports the wait', () => {
    let clock = 1_000
    const limiter = createRateLimiter({
      maxRequests: 3,
      windowMs: 60_000,
      now: () => clock,
    })

    expect(limiter.check()).toEqual({ canProceed: true, timeRemainingMs: 0 })
    clock += 1_000
    expect(limiter.check().canProceed).toBe(true)
    clock += 1_000
    expect(limiter.check().canProceed).toBe(true)

    clock += 1_000
    const blocked = limiter.check()
    expect(blocked.canProceed).toBe(false)
    expect(blocked.timeRemainingMs).toBe(57_000)

    // Rolling window: the first request ages out after 60 s.
    clock = 1_000 + 60_000
    expect(limiter.check().canProceed).toBe(true)
  })

  it('reset() clears the window', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000, now: () => 0 })
    expect(limiter.check().canProceed).toBe(true)
    expect(limiter.check().canProceed).toBe(false)
    limiter.reset()
    expect(limiter.check().canProceed).toBe(true)
  })

  it('formats the remaining time in the frozen toast wording', () => {
    expect(formatTimeRemaining(1_400)).toBe('2 seconds')
    expect(formatTimeRemaining(60_000)).toBe('a minute')
    expect(formatTimeRemaining(0)).toBe('1 second')
  })
})

describe('formatGuestbookDate', () => {
  const now = new Date('2026-11-08T17:00:00.000Z').getTime()

  it('formats fixture dates with the year when it differs from the current year', () => {
    expect(formatGuestbookDate('2025-05-12T15:00:00.000Z', now)).toBe('May 12, 2025')
  })

  it('hides the year when the timestamp is in the current year', () => {
    expect(formatGuestbookDate('2026-11-08T17:00:00.000Z', now)).toBe('Nov 8')
  })

  it('handles missing and invalid timestamps', () => {
    expect(formatGuestbookDate(undefined, now)).toBe('Just now')
    expect(formatGuestbookDate('not-a-date', now)).toBe('not-a-date')
  })
})

describe('composer validation', () => {
  it('requires a 2-50 char name and a 10+ char message', () => {
    expect(validateComposerFields({ name: '', email: '', content: '' }).name).toMatch(
      /between 2 and 50/
    )
    expect(validateComposerFields({ name: 'A', email: '', content: 'short' }).content).toMatch(
      /at least 10/
    )
    expect(
      validateComposerFields({ name: 'x'.repeat(51), email: '', content: 'x'.repeat(11) }).name
    ).toMatch(/between 2 and 50/)
    expect(validateComposerFields({ name: 'Austin', email: '', content: 'x'.repeat(11) })).toEqual(
      {}
    )
  })

  it('validates an optional email only when provided', () => {
    expect(validateComposerFields({ name: 'Austin', email: '', content: 'x'.repeat(11) })).toEqual(
      {}
    )
    expect(
      validateComposerFields({ name: 'Austin', email: 'bad-email', content: 'x'.repeat(11) }).email
    ).toBe('Enter a valid email address.')
    expect(
      validateComposerFields({ name: 'Austin', email: 'a@b.co', content: 'x'.repeat(11) })
    ).toEqual({})
  })
})

describe('reaction fingerprint dedupe markers', () => {
  it('creates and persists one fingerprint per storage', () => {
    const storage = memoryStorage()
    const first = getOrCreateReactionFingerprint(storage, () => 'fingerprint-1')
    expect(first).toBe('fingerprint-1')
    expect(getOrCreateReactionFingerprint(storage, () => 'fingerprint-2')).toBe('fingerprint-1')
  })

  it('marks/unmarks per (message, reaction) and reports reacted state', () => {
    const storage = memoryStorage()
    const key = reactionMarkerKey('message-1', 'love', 'fp-1')
    expect(key).toBe('wedding-reacted:message-1:love:fp-1')

    expect(hasReacted('message-1', 'love', 'fp-1', storage)).toBe(false)
    markReacted('message-1', 'love', 'fp-1', storage)
    expect(hasReacted('message-1', 'love', 'fp-1', storage)).toBe(true)
    expect(hasReacted('message-1', 'clap', 'fp-1', storage)).toBe(false)
    expect(hasReacted('message-2', 'love', 'fp-1', storage)).toBe(false)

    unmarkReacted('message-1', 'love', 'fp-1', storage)
    expect(hasReacted('message-1', 'love', 'fp-1', storage)).toBe(false)
  })
})

describe('stub API', () => {
  it('returns the frozen fixtures and deterministic writes', async () => {
    const api = createStubGuestbookApi()

    const messages = await api.loadMessages()
    expect(messages.map(message => message.name)).toEqual([
      'Sarah Mitchell',
      'Mike Chen',
      'Aunt Patricia',
    ])
    expect(messages[0]?.reactions).toEqual({ love: 12, clap: 4 })
    expect(messages[0]?.comments[0]?.author).toBe('Austin')
    expect(GUESTBOOK_FIXTURE).toHaveLength(3)

    const submitted = await api.submitMessage({
      name: 'New Guest',
      email: '',
      content: 'A perfectly deterministic note.',
    })
    expect(submitted).toEqual({
      status: 'submitted',
      messageId: 'stub-message-1',
      rateLimitRemaining: null,
      viaFallback: false,
    })

    const reply = await api.addReply({ messageId: 'message-1', author: 'Guest', content: 'Hi' })
    expect(reply).toEqual({
      id: 'stub-reply-1',
      author: 'Guest',
      content: 'Hi',
      createdAt: GUESTBOOK_FIXED_NOW,
    })
  })
})
