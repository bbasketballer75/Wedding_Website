/**
 * Retry helper for transient network failures — port of the frozen
 * `src/utils/retry.ts`. Only transient errors are retried (network/timeout/5xx);
 * validation/auth errors surface immediately. The sleep is injectable so tests
 * never wait on real timers.
 */

const TRANSIENT_ERROR_NAMES = new Set([
  'AbortError',
  'TimeoutError',
  'NetworkError',
  'TypeError', // fetch() throws TypeError on network failures
])

export function isTransientError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) {
    if (TRANSIENT_ERROR_NAMES.has(error.name)) return true
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return true
    }
  }
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: number }).status
    if (typeof status === 'number' && status >= 500 && status < 600) return true
  }
  return false
}

export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
  /** Injectable delay (tests pass an immediate resolver). */
  sleep?: (delayMs: number) => Promise<void>
}

const defaultSleep = (delayMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, delayMs)
  })

export async function withRetry<T>(
  fn: () => PromiseLike<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, onRetry, sleep = defaultSleep } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const transient = isTransientError(error)
      const isLastAttempt = attempt === attempts
      if (!transient || isLastAttempt) throw error

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
      onRetry?.(attempt, error, delayMs)
      await sleep(delayMs)
    }
  }
  throw lastError
}
