/**
 * Environment contract (QUALITY_BAR: fail fast with a readable error).
 *
 * Parsing is a pure function over an env record so it can be unit-tested and so
 * Wave 1 does not require real Supabase credentials to build. Wave 3 calls
 * `readEnv(import.meta.env)` at the data-layer boundary.
 *
 * The contract is six string fields, so it is validated by hand instead of with
 * a schema library. `zod` re-exports its entire surface (every locale, the
 * JSON-Schema bridge, the compiler) as a single namespace object, so importing
 * it dragged all of that into the shared `schema` chunk — 642 kB of source for
 * six fields, and that chunk already sits 1.1 KiB under the 120 KiB
 * QUALITY_BAR route-chunk budget (scripts/check-budgets.mjs). Validating the
 * six fields directly keeps the client bundle ~22 KiB gzip lighter and leaves
 * the route-chunk budget with real headroom.
 *
 * The rules below mirror the previous `zod` schema exactly:
 *   - VITE_SUPABASE_URL: required, must parse as a URL
 *   - VITE_SUPABASE_ANON_KEY: required, must not be blank
 *   - VITE_SITE_URL: optional URL, defaults to https://www.theporadas.com
 *   - VITE_MEDIA_BASE_URL / VITE_SENTRY_DSN: optional URLs
 *   - VITE_GA_ID: optional non-blank string
 *   - blank values count as absent, and every value is trimmed
 */

/**
 * Blank values are treated as absent: the frozen app (and Netlify/CI env panels)
 * routinely leave optional variables defined-but-empty, and an empty string must
 * not fail URL validation.
 */
const blankToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * A value is a URL when it parses as one. `zod` used the same test
 * (`new URL(value)` inside a try/catch), so this keeps the accepted set
 * identical.
 */
const isUrl = (value: string): boolean => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export interface AppEnv {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  VITE_SITE_URL: string
  VITE_MEDIA_BASE_URL?: string
  VITE_SENTRY_DSN?: string
  VITE_GA_ID?: string
}

export function readEnv(source: Record<string, string | boolean | undefined>): AppEnv {
  const issues: string[] = []

  const required = (key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string => {
    const value = blankToUndefined(source[key])
    if (value === undefined) {
      issues.push(`  - ${key}: ${key} is required`)
      return ''
    }
    return value
  }

  const optional = (key: string, validate?: (value: string) => boolean): string | undefined => {
    const value = blankToUndefined(source[key])
    if (value === undefined) return undefined
    if (validate && !validate(value)) {
      issues.push(`  - ${key}: ${key} must be a valid URL`)
      return undefined
    }
    return value
  }

  const supabaseUrl = required('VITE_SUPABASE_URL')
  if (supabaseUrl !== '' && !isUrl(supabaseUrl)) {
    issues.push('  - VITE_SUPABASE_URL: VITE_SUPABASE_URL must be a valid URL')
  }
  const anonKey = required('VITE_SUPABASE_ANON_KEY')
  const siteUrl = optional('VITE_SITE_URL', isUrl) ?? 'https://www.theporadas.com'
  const mediaBaseUrl = optional('VITE_MEDIA_BASE_URL', isUrl)
  const sentryDsn = optional('VITE_SENTRY_DSN', isUrl)
  const gaId = optional('VITE_GA_ID')

  if (issues.length > 0) {
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`)
  }

  return {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
    VITE_SITE_URL: siteUrl,
    ...(mediaBaseUrl === undefined ? {} : { VITE_MEDIA_BASE_URL: mediaBaseUrl }),
    ...(sentryDsn === undefined ? {} : { VITE_SENTRY_DSN: sentryDsn }),
    ...(gaId === undefined ? {} : { VITE_GA_ID: gaId }),
  }
}

/**
 * Read the build-time environment.
 *
 * Each property is accessed statically on `import.meta.env` so Vite's build
 * replaces it with the literal value. Spreading `import.meta.env` does NOT work
 * in a production build: unprefixed values are not present on the replaced
 * object, so the schema would see `undefined`. This is the single runtime entry
 * point for env validation (Wave 3 client + future consumers).
 */
export function readAppEnv(): AppEnv {
  return readEnv({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SITE_URL: import.meta.env.VITE_SITE_URL,
    VITE_MEDIA_BASE_URL: import.meta.env.VITE_MEDIA_BASE_URL,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_GA_ID: import.meta.env.VITE_GA_ID,
  })
}
