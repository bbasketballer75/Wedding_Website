/**
 * Frozen `formatGuestbookDate` (`src/pages/guestbook/guestbookText.ts`).
 *
 * The oracle hides the year when it equals the *current* year, which makes the
 * output time-dependent. The `now` argument is therefore injectable so tests can
 * pin the clock (the page passes the real current time, matching the oracle).
 */
export function formatGuestbookDate(timestamp?: string, now: number = Date.now()): string {
  if (!timestamp) return 'Just now'
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  const currentYear = new Date(now).getFullYear()
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: parsed.getFullYear() !== currentYear ? 'numeric' : undefined,
  })
}
