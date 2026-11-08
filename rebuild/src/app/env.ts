/**
 * Environment contract (QUALITY_BAR: fail fast with a readable error).
 *
 * Parsing is a pure function over an env record so it can be unit-tested and so
 * Wave 1 does not require real Supabase credentials to build. Wave 3 calls
 * `readEnv(import.meta.env)` at the data-layer boundary.
 */
import { z } from 'zod'

export const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_SITE_URL: z.string().url().default('https://www.theporadas.com'),
  VITE_MEDIA_BASE_URL: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_GA_ID: z.string().min(1).optional(),
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
