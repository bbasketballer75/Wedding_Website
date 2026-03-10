/**
 * Rate Limiter Utility
 * Provides client-side rate limiting for user actions like form submissions
 */

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

interface RateLimitEntry {
  timestamps: number[]
}

/**
 * Client-side rate limiter for user actions
 * Note: This provides UX feedback only - server-side rate limiting is still required for security
 */
class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map()

  /**
   * Check if the action can proceed and record the request
   * @param key - Unique identifier for the action (e.g., 'guestbook-submit', 'memory-submit')
   * @param options - Rate limit configuration
   * @returns Object containing whether the action can proceed and time remaining if limited
   */
  check(key: string, options: RateLimitOptions): { canProceed: boolean; timeRemainingMs: number } {
    const now = Date.now()
    const entry = this.requests.get(key)
    const windowStart = now - options.windowMs

    // Get existing timestamps or initialize new array
    const timestamps = entry?.timestamps || []

    // Filter out timestamps outside the current window
    const recentTimestamps = timestamps.filter(ts => ts > windowStart)

    // Check if rate limit exceeded
    if (recentTimestamps.length >= options.maxRequests) {
      const oldestTimestamp = recentTimestamps[0]
      const timeRemainingMs = oldestTimestamp + options.windowMs - now
      return { canProceed: false, timeRemainingMs }
    }

    // Record this request
    recentTimestamps.push(now)
    this.requests.set(key, { timestamps: recentTimestamps })

    return { canProceed: true, timeRemainingMs: 0 }
  }

  /**
   * Simple boolean check - returns true if action can proceed
   * @param key - Unique identifier for the action
   * @param options - Rate limit configuration
   * @returns true if the action can proceed, false if rate limited
   */
  canProceed(key: string, options: RateLimitOptions): boolean {
    return this.check(key, options).canProceed
  }

  /**
   * Get remaining requests and time until reset for a key
   * @param key - Unique identifier for the action
   * @param options - Rate limit configuration
   * @returns Object with remaining requests and time until reset
   */
  getStatus(key: string, options: RateLimitOptions): { remaining: number; resetInMs: number } {
    const now = Date.now()
    const entry = this.requests.get(key)
    const windowStart = now - options.windowMs

    const timestamps = entry?.timestamps || []
    const recentTimestamps = timestamps.filter(ts => ts > windowStart)

    const remaining = Math.max(0, options.maxRequests - recentTimestamps.length)
    const resetInMs = recentTimestamps.length > 0
      ? recentTimestamps[0] + options.windowMs - now
      : 0

    return { remaining, resetInMs }
  }

  /**
   * Clear rate limit for a specific key
   * @param key - Unique identifier for the action
   */
  clear(key: string): void {
    this.requests.delete(key)
  }

  /**
   * Clear all rate limits (useful for testing)
   */
  clearAll(): void {
    this.requests.clear()
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()

/**
 * Format milliseconds into a human-readable string
 * @param ms - Time in milliseconds
 * @returns Formatted string (e.g., "1 minute", "30 seconds")
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  const minutes = Math.ceil(seconds / 60)
  const hours = Math.ceil(minutes / 60)

  if (hours > 1) {
    return `${hours} minutes`
  } else if (minutes > 1) {
    return `${minutes} minutes`
  } else if (seconds > 1) {
    return `${seconds} seconds`
  }
  return 'a moment'
}

export default rateLimiter
