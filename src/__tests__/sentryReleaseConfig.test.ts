/**
 * Regression tests for the build-time Sentry release identity.
 *
 * Background: production shipped `release: "2026-04-14-launch"` on every deploy
 * because `VITE_APP_VERSION` is a static Netlify env value, and the fallback was
 * the package version (`0.0.0`). A release that does not change per deploy can
 * never be matched to per-deploy source map artifacts, and error regressions
 * cannot be attributed to a commit. The build now derives the release from the
 * deploy commit ref, falling back to the static label only for local builds.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

const CONFIG_PATH = '../../vite.config.js'

interface ResolvedConfig {
  define: Record<string, string>
  build: Record<string, unknown>
  plugins: Array<{ name?: string } | false | null | undefined>
}

async function resolveConfig(env: Record<string, string | undefined>): Promise<ResolvedConfig> {
  const keys = [
    'COMMIT_REF',
    'VITE_APP_VERSION',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
  ]
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]))

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  vi.resetModules()
  const mod = await import(/* @vite-ignore */ CONFIG_PATH)
  const config = (mod.default as (ctx: { mode: string }) => ResolvedConfig)({ mode: 'production' })

  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  return config
}

function releaseOf(config: ResolvedConfig): string {
  return JSON.parse(config.define.__APP_VERSION__) as string
}

const COMMIT = 'ffc68009edc0772c42bb721df5d7a265b376d157'

describe('Sentry release identity (vite build define)', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('uses the deploy commit ref so every deploy gets a distinct release', async () => {
    const config = await resolveConfig({
      COMMIT_REF: COMMIT,
      VITE_APP_VERSION: '2026-04-14-launch',
      SENTRY_AUTH_TOKEN: undefined,
    })

    expect(releaseOf(config)).toBe(COMMIT)
  })

  it('produces different releases for different commits', async () => {
    const first = await resolveConfig({ COMMIT_REF: COMMIT, SENTRY_AUTH_TOKEN: undefined })
    const second = await resolveConfig({
      COMMIT_REF: '0123456789abcdef0123456789abcdef01234567',
      SENTRY_AUTH_TOKEN: undefined,
    })

    expect(releaseOf(first)).not.toBe(releaseOf(second))
  })

  it('falls back to VITE_APP_VERSION when no commit ref is available (local builds)', async () => {
    const config = await resolveConfig({
      COMMIT_REF: undefined,
      VITE_APP_VERSION: 'local-build-label',
      SENTRY_AUTH_TOKEN: undefined,
    })

    expect(releaseOf(config)).toBe('local-build-label')
  })

  it('falls back to the package version when nothing else is set', async () => {
    const config = await resolveConfig({
      COMMIT_REF: undefined,
      VITE_APP_VERSION: undefined,
      SENTRY_AUTH_TOKEN: undefined,
    })

    expect(releaseOf(config)).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('Sentry source map emission (vite build)', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('emits hidden source maps when source map upload credentials are present', async () => {
    const config = await resolveConfig({
      SENTRY_AUTH_TOKEN: 'test-token',
      SENTRY_ORG: 'friendly-city-t9',
      SENTRY_PROJECT: 'theporadas-com',
      SENTRY_DSN:
        'https://00000000000000000000000000000000@o4511356027011072.ingest.us.sentry.io/4512087393042432',
    })

    expect(config.build.sourcemap).toBe('hidden')
  })

  it('never emits published source maps without upload credentials', async () => {
    const config = await resolveConfig({ SENTRY_AUTH_TOKEN: undefined })

    expect(config.build.sourcemap).toBe(false)
  })
})
