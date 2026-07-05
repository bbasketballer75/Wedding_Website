/**
 * Retry helper for transient network failures.
 *
 * Only retries on errors that look transient (network timeouts, 5xx, AbortError).
 * Does NOT retry on validation errors (4xx), auth errors (401/403), or business
 * logic errors — those won't get better with another attempt and the user should
 * see them immediately.
 *
 * Exponential backoff: base delay doubles each attempt (500ms, 1s, 2s by default).
 */

export type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  /** Optional callback after each failed attempt. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

const TRANSIENT_ERROR_NAMES = new Set([
  'AbortError',
  'TimeoutError',
  'NetworkError',
  'TypeError', // fetch() throws TypeError on network failures
])

function isTransientError(error: unknown): boolean {
  if (!error) return false

  // Plain Error with retryable properties
  if (error instanceof Error) {
    if (TRANSIENT_ERROR_NAMES.has(error.name)) return true
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return true
    }
  }

  // Supabase PostgrestError / object with status
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: number }).status
    if (typeof status === 'number' && status >= 500 && status < 600) return true
  }

  return false
}

export async function withRetry<T>(
  fn: () => PromiseLike<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, onRetry } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      const transient = isTransientError(err)
      const isLastAttempt = attempt === attempts

      if (!transient || isLastAttempt) {
        throw err
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
      if (onRetry) onRetry(attempt, err, delayMs)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

export { isTransientError }
