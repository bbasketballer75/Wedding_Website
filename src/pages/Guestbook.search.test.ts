/**
 * Unit tests for the guestbook search/filter logic.
 *
 * These mirror the filter predicate and pagination-reset behaviour
 * implemented in Guestbook.tsx without needing to render the full page
 * (which would require mocking Supabase, routing, etc.).
 */

import { describe, it, expect } from 'vitest'

// ─── Predicate ────────────────────────────────────────────────────────────────
// This mirrors `messages.filter(m => ...)` in Guestbook.tsx.

function matchesQuery(message: { name: string; content: string }, query: string): boolean {
  const q = query.toLowerCase()
  return message.name.toLowerCase().includes(q) || message.content.toLowerCase().includes(q)
}

function applyFilter(
  messages: Array<{ name: string; content: string }>,
  searchQuery: string
): typeof messages {
  return searchQuery.trim() ? messages.filter(m => matchesQuery(m, searchQuery)) : messages
}

// ─── Pagination reset ─────────────────────────────────────────────────────────
// The Guestbook resets visibleCount to INITIAL_VISIBLE_MESSAGES when searchQuery changes.
// We verify the visible-slice behaviour mirrors what the component produces.

const INITIAL_VISIBLE_MESSAGES = 10 // must match the constant in Guestbook.tsx

function computeVisible<T>(items: T[], visibleCount: number): T[] {
  return items.slice(0, Math.min(visibleCount, items.length))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const MESSAGES = [
  { name: 'Alice Johnson', content: 'Congratulations on your wedding!' },
  { name: 'Bob Smith', content: 'Wishing you all the happiness in the world.' },
  { name: 'Carol White', content: 'Such a beautiful ceremony, Alice!' },
  { name: 'David Lee', content: 'So glad to celebrate with you both.' },
]

describe('Guestbook search filter', () => {
  it('returns all messages when query is empty string', () => {
    expect(applyFilter(MESSAGES, '')).toHaveLength(4)
  })

  it('returns all messages when query is whitespace only', () => {
    expect(applyFilter(MESSAGES, '   ')).toHaveLength(4)
  })

  it('filters by name (case-insensitive)', () => {
    const result = applyFilter(MESSAGES, 'alice')
    // Matches Alice Johnson (name) and Carol White (content mentions "Alice")
    expect(result).toHaveLength(2)
    expect(result.map(m => m.name)).toContain('Alice Johnson')
    expect(result.map(m => m.name)).toContain('Carol White')
  })

  it('filters by content substring', () => {
    const result = applyFilter(MESSAGES, 'happiness')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob Smith')
  })

  it('is case-insensitive for both name and content', () => {
    const lower = applyFilter(MESSAGES, 'congratulations')
    const upper = applyFilter(MESSAGES, 'CONGRATULATIONS')
    expect(lower).toEqual(upper)
    expect(lower).toHaveLength(1)
  })

  it('returns an empty array when no message matches', () => {
    expect(applyFilter(MESSAGES, 'xyz_no_match_99')).toHaveLength(0)
  })

  it('matches partial content correctly', () => {
    const result = applyFilter(MESSAGES, 'celeb')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('David Lee')
  })
})

describe('Guestbook pagination — computeVisible', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i }))

  it('returns at most visibleCount items', () => {
    expect(computeVisible(items, INITIAL_VISIBLE_MESSAGES)).toHaveLength(INITIAL_VISIBLE_MESSAGES)
  })

  it('never returns more items than exist in the filtered set', () => {
    const small = items.slice(0, 3)
    // Even with a large visibleCount (e.g. stale from before search), cap at actual length
    expect(computeVisible(small, 30)).toHaveLength(3)
  })

  it('returns all items when visibleCount equals list length', () => {
    expect(computeVisible(items, 25)).toHaveLength(25)
  })

  it('returns empty array for empty list regardless of visibleCount', () => {
    expect(computeVisible([], 10)).toHaveLength(0)
  })
})
