/**
 * Relative-time formatter for activity cards.
 *
 * The frozen card uses `date-fns` `formatDistanceToNow(..., { addSuffix: true })`
 * (`src/components/activity/ActivityCard.tsx`). The greenfield dependency policy does
 * not allow adding `date-fns`, so this module ports the exact English `formatDistance`
 * algorithm (date-fns v4.4: 30 s / 45 min / 90 min / 24 h / 42 h / 30 d / 60 d / 12 mo
 * buckets plus the about/over/almost year branches) using only `Intl`-free arithmetic.
 *
 * Determinism notes:
 * - `now` is a parameter (the parity harness freezes `Date`, tests pin it), so the
 *   rendered string never depends on the machine clock.
 * - Calendar months are computed in UTC on purpose: the frozen oracle was captured
 *   in `America/New_York`, while CI runs in UTC. A ±1-month difference is only
 *   possible for an exact month boundary that crosses a DST change; the fixture
 *   dates (2025-05-10 / 2025-05-12 vs 2026-11-08) are far from that edge.
 */

const MINUTES_IN_DAY = 24 * 60
const MINUTES_IN_MONTH = 30 * MINUTES_IN_DAY
const MINUTES_IN_ALMOST_TWO_DAYS = 42 * 60

function pluralize(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? '' : 's'}`
}

function differenceInSeconds(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 1000)
}

function differenceInCalendarMonthsUtc(later: Date, earlier: Date): number {
  return (
    (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
    (later.getUTCMonth() - earlier.getUTCMonth())
  )
}

/** `addMonths` with day clamping, matching date-fns' `addMonths` semantics (UTC). */
function addMonthsUtc(date: Date, amount: number): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + amount)
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate()
  result.setUTCDate(Math.min(day, daysInTargetMonth))
  return result
}

/** date-fns `differenceInMonths` (whole, non-rounded months) in UTC. */
export function differenceInMonthsUtc(later: Date, earlier: Date): number {
  const calendarMonths = Math.abs(differenceInCalendarMonthsUtc(later, earlier))
  const isLastMonthNotFull = addMonthsUtc(earlier, calendarMonths).getTime() > later.getTime()
  return calendarMonths - (isLastMonthNotFull ? 1 : 0)
}

/**
 * English distance wording without a suffix (date-fns `formatDistance` core).
 * `later` must be chronologically >= `earlier`.
 */
function formatDistance(later: Date, earlier: Date): string {
  const seconds = differenceInSeconds(later, earlier)
  const minutes = Math.round(seconds / 60)

  // 0 up to 2 minutes
  if (minutes < 2) {
    return minutes === 0 ? 'less than a minute' : pluralize(minutes, 'minute')
    // 2 minutes up to 45 minutes
  } else if (minutes < 45) {
    return pluralize(minutes, 'minute')
    // 45 minutes up to 1.5 hours
  } else if (minutes < 90) {
    return 'about 1 hour'
    // 1.5 hours up to 24 hours
  } else if (minutes < MINUTES_IN_DAY) {
    return `about ${pluralize(Math.round(minutes / 60), 'hour')}`
    // 24 hours up to 1.75 days
  } else if (minutes < MINUTES_IN_ALMOST_TWO_DAYS) {
    return '1 day'
    // 1.75 days up to 30 days
  } else if (minutes < MINUTES_IN_MONTH) {
    return pluralize(Math.round(minutes / MINUTES_IN_DAY), 'day')
    // 1 month up to 2 months
  } else if (minutes < MINUTES_IN_MONTH * 2) {
    return `about ${pluralize(Math.round(minutes / MINUTES_IN_MONTH), 'month')}`
  }

  const months = differenceInMonthsUtc(later, earlier)

  // 2 months up to 12 months
  if (months < 12) {
    return pluralize(Math.round(minutes / MINUTES_IN_MONTH), 'month')
  }

  // 1 year and up: about N years / over N years / almost N+1 years
  const monthsSinceStartOfYear = months % 12
  const years = Math.trunc(months / 12)
  if (monthsSinceStartOfYear < 3) {
    return `about ${pluralize(years, 'year')}`
  }
  if (monthsSinceStartOfYear < 9) {
    return `over ${pluralize(years, 'year')}`
  }
  return `almost ${pluralize(years + 1, 'year')}`
}

/**
 * Frozen `formatDistanceToNow(new Date(createdAt), { addSuffix: true })` equivalent.
 * Returns '' for missing/invalid timestamps (the frozen card rendered nothing then).
 */
export function formatActivityTime(
  createdAt: string | null | undefined,
  now: Date = new Date()
): string {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  const timestamp = date.getTime()
  const nowTimestamp = now.getTime()
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowTimestamp)) return ''

  const comparison = timestamp === nowTimestamp ? 0 : timestamp > nowTimestamp ? 1 : -1
  const later = comparison > 0 ? date : now
  const earlier = comparison > 0 ? now : date
  const distance = formatDistance(later, earlier)
  return comparison > 0 ? `in ${distance}` : `${distance} ago`
}
