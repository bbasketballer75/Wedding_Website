/**
 * One normalised error shape for the whole data layer.
 *
 * Rule (QUALITY_BAR): raw PostgREST/Auth/network messages never reach UI
 * callers. Every module funnels failures through `toDataError`, which keeps the
 * original error in `cause` for logging/debugging but exposes a stable, safe
 * `message` + machine-readable `code` to the app.
 */

/** Default user-safe message when a failure has no known friendly text. */
export const DEFAULT_DATA_ERROR_MESSAGE =
  'Something went wrong loading this content. Please try again.'

export interface DataErrorProperties {
  message?: string
  /** Stable machine code, e.g. `postgrest:42501`, `auth`, `network`, `unknown`. */
  code?: string
  cause?: unknown
}

/**
 * Normalised data-layer error.
 *
 * - `code` is safe to branch on in the UI (never contains user data).
 * - `message` is already user-safe.
 * - `cause` is the raw error, kept for logging only.
 */
export class DataError extends Error {
  readonly code: string
  override readonly cause: unknown

  constructor(properties: DataErrorProperties = {}) {
    super(properties.message ?? DEFAULT_DATA_ERROR_MESSAGE)
    this.name = 'DataError'
    this.code = properties.code ?? 'unknown'
    this.cause = properties.cause
  }
}

/** Type guard for wrapped data-layer failures. */
export function isDataError(value: unknown): value is DataError {
  return value instanceof DataError
}

const POSTGREST_CODES = new Set([
  'PGRST116', // 0 rows for .single()
  'PGRST301', // JWT expired
  '42501', // insufficient privilege (RLS)
  '23505', // unique violation
  '23503', // foreign key violation
  '23514', // check constraint violation
  '22P02', // invalid input syntax
])

interface ErrorLikeRecord {
  message?: unknown
  code?: unknown
  name?: unknown
  status?: unknown
}

function asRecord(value: unknown): ErrorLikeRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /failed to fetch|networkerror|network request failed|load failed/i.test(error.message)
}

/** Read a known machine code from a raw PostgREST/Auth/HTTP-ish error. */
function readErrorCode(error: unknown): string | null {
  const record = asRecord(error)
  if (!record) return null

  if (typeof record.code === 'string' && record.code.length > 0) {
    return POSTGREST_CODES.has(record.code) || /^PGRST\d+$/.test(record.code)
      ? `postgrest:${record.code}`
      : record.code
  }

  if (typeof record.name === 'string' && record.name === 'AuthApiError') return 'auth'
  if (typeof record.status === 'number') return `http:${record.status}`

  return null
}

/**
 * Normalise any thrown/failed value into a single `DataError`.
 *
 * @param error raw thrown value / PostgREST error object
 * @param fallbackMessage optional user-safe message for this call site
 */
export function toDataError(error: unknown, fallbackMessage?: string): DataError {
  if (isDataError(error)) return error

  const explicitCode = readErrorCode(error)
  const code =
    explicitCode ??
    (isNetworkFailure(error) ? 'network' : error instanceof Error ? 'unknown' : 'unknown')

  return new DataError({
    message: fallbackMessage ?? DEFAULT_DATA_ERROR_MESSAGE,
    code,
    cause: error,
  })
}

/**
 * Unwrap a `{ data, error }` PostgREST result: returns data or throws DataError.
 * Keeps modules free of repetitive `if (error) throw` blocks while preserving
 * the single error shape.
 */
export function unwrapResult<Data>(
  result: { data: Data; error: unknown },
  fallbackMessage?: string
): Data {
  if (result.error) throw toDataError(result.error, fallbackMessage)
  return result.data
}

/** Unwrap a PostgREST result whose `data` may legitimately be `null`. */
export function unwrapNullableResult<Data>(
  result: { data: Data | null; error: unknown },
  fallbackMessage?: string
): Data | null {
  if (result.error) {
    // PGRST116 means "0 rows for .single()" — callers that use maybeSingle/single
    // should treat that as absence, not as a failure.
    const code = toDataError(result.error).code
    if (code === 'postgrest:PGRST116') return null
    throw toDataError(result.error, fallbackMessage)
  }
  return result.data
}
