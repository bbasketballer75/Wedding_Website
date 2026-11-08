/**
 * Environment contract (QUALITY_BAR: fail fast with a readable error).
 *
 * Parsing is a pure function over an env record so it can be unit-tested and so
 * Wave 1 does not require real Supabase credentials to build. Wave 3 calls
 * `readEnv(import.meta.env)` at the data-layer boundary.
 */
import { z } from 'zod'

/**
 * Blank values are treated as absent: the frozen app (and Netlify/CI env panels)
 * routinely leave optional variables defined-but-empty, and an empty string must
 * not fail URL validation.
 */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional())
const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional())

export const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_SITE_URL: z.preprocess(
    blankToUndefined,
    z.string().url().default('https://www.theporadas.com')
  ),
  VITE_MEDIA_BASE_URL: optionalUrl,
  VITE_SENTRY_DSN: optionalUrl,
  VITE_GA_ID: optionalString,
})

export type AppEnv = z.infer<typeof envSchema>

export function readEnv(source: Record<string, string | boolean | undefined>): AppEnv {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const details = result.error.issues.map(
      issue => `  - ${issue.path.join('.')}: ${issue.message}`
    )
    throw new Error(`Invalid environment configuration:\n${details.join('\n')}`)
  }

  return result.data
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
