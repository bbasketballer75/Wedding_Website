/**
 * Client-side submit limiter (frozen `@/utils/rateLimiter` contract): 3 notes
 * per rolling minute, checked before the network call so a double-click cannot
 * burn the server budget. `now` is injectable so tests need no fake timers.
 */

export interface RateLimitCheck {
  canProceed: boolean
  timeRemainingMs: number
}

export interface RateLimiter {
  check: () => RateLimitCheck
  reset: () => void
}

export interface RateLimiterOptions {
  maxRequests: number
  windowMs: number
  now?: () => number
}

export function createRateLimiter({
  maxRequests,
  windowMs,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  const timestamps: number[] = []

  const prune = (current: number) => {
    while (timestamps.length > 0 && current - (timestamps[0] as number) >= windowMs) {
      timestamps.shift()
    }
  }

  return {
    check: () => {
      const current = now()
      prune(current)
      if (timestamps.length < maxRequests) {
        timestamps.push(current)
        return { canProceed: true, timeRemainingMs: 0 }
      }
      const oldest = timestamps[0] as number
      return { canProceed: false, timeRemainingMs: Math.max(0, windowMs - (current - oldest)) }
    },
    reset: () => {
      timestamps.length = 0
    },
  }
}

/** Frozen toast wording helper (`formatTimeRemaining`). */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  if (seconds >= 60) return 'a minute'
  return `${seconds} second${seconds === 1 ? '' : 's'}`
}
