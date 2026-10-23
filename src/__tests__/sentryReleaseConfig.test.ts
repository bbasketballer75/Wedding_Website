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

// Every case here resolves the real vite.config.js, which drags in the whole
// plugin graph (react compiler, tailwind, PWA, sentry). Under a full-suite run
// that first dynamic import can take several seconds; the 5s default then fires
// mid-await, which also leaves process.env mutated and cascades into later
// assertions. The extra budget keeps the gate about behaviour, not machine load.
vi.setConfig({ testTimeout: 30_000 })

const CONFIG_PATH = '../../vite.config.js'

interface ResolvedConfig {
  define: Record<string, string>
  build: Record<string, unknown>
  plugins: Array<{ name?: string } | false | null | undefined>
}

const CONFIG_KEYS = [
  'COMMIT_REF',
  'CONTEXT',
  'NETLIFY',
  'VITE_APP_VERSION',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
]

async function resolveConfig(env: Record<string, string | undefined>): Promise<ResolvedConfig> {
  const saved = Object.fromEntries(CONFIG_KEYS.map(key => [key, process.env[key]]))

  for (const key of CONFIG_KEYS) {
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }

  try {
    vi.resetModules()
    const mod = await import(/* @vite-ignore */ CONFIG_PATH)
    return (mod.default as (ctx: { mode: string }) => ResolvedConfig)({ mode: 'production' })
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

/** Resolve the config and return the error it threw, or undefined if it succeeded. */
async function failureOf(env: Record<string, string | undefined>): Promise<Error | undefined> {
  try {
    await resolveConfig(env)
    return undefined
  } catch (error) {
    return error as Error
  }
}

function sentryPluginOf(config: ResolvedConfig): boolean {
  const plugins = config.plugins.flat(Infinity) as Array<{ name?: string }>
  return plugins.some(plugin => plugin?.name?.startsWith('sentry-'))
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
    })

    expect(config.build.sourcemap).toBe('hidden')
    const plugins = config.plugins.flat(Infinity) as Array<{ name?: string }>
    expect(plugins.some(plugin => plugin?.name?.startsWith('sentry-'))).toBe(true)
  })

  it('never emits published source maps without upload credentials', async () => {
    const config = await resolveConfig({ SENTRY_AUTH_TOKEN: undefined })

    expect(config.build.sourcemap).toBe(false)
    const plugins = config.plugins.flat(Infinity) as Array<{ name?: string }>
    expect(plugins.some(plugin => plugin?.name?.startsWith('sentry-'))).toBe(false)
  })

  const credentials = {
    SENTRY_AUTH_TOKEN: 'fixture-token-never-log',
    SENTRY_ORG: 'friendly-city-t9',
    SENTRY_PROJECT: 'theporadas-com',
  }
  const names = Object.keys(credentials) as Array<keyof typeof credentials>
  for (let mask = 1; mask < 7; mask += 1) {
    const configured = names.filter((_, index) => mask & (1 << index))
    it(`refuses partial source-map credentials: ${configured.join(', ')}`, async () => {
      const env = Object.fromEntries(configured.map(name => [name, credentials[name]]))
      const missing = names.filter(name => !configured.includes(name))
      let failure: unknown
      try {
        await resolveConfig(env)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      const message = (failure as Error).message
      expect(message).toContain('Incomplete Sentry source-map configuration')
      for (const name of missing) expect(message).toContain(name)
      expect(message).not.toContain(credentials.SENTRY_AUTH_TOKEN)
      expect(message).not.toContain(credentials.SENTRY_ORG)
      expect(message).not.toContain(credentials.SENTRY_PROJECT)
    })
  }
})

describe('Sentry credential normalization (vite build)', () => {
  const credentials = {
    SENTRY_AUTH_TOKEN: 'fixture-token-never-log',
    SENTRY_ORG: 'friendly-city-t9',
    SENTRY_PROJECT: 'theporadas-com',
  }
  const names = Object.keys(credentials) as Array<keyof typeof credentials>

  afterEach(() => {
    vi.resetModules()
  })

  // Every combination of real, empty, and whitespace-only values. "Absent"
  // must mean the same thing to the fail-closed guard and to the flag that
  // enables the upload, or a half-blank environment uploads with blank
  // credentials instead of failing.
  const states: Array<[string, string]> = [
    ['real', 'real'],
    ['empty', ''],
    ['whitespace', '   '],
  ]
  const combinations = states.flatMap(([aLabel, aValue]) =>
    states.flatMap(([bLabel, bValue]) =>
      states.map(([cLabel, cValue]) => ({
        label: `${aLabel}/${bLabel}/${cLabel}`,
        values: [aValue, bValue, cValue],
      }))
    )
  )

  for (const { label, values } of combinations) {
    it(`classifies ${label} consistently between the guard and the upload flag`, async () => {
      const env = Object.fromEntries(names.map((name, index) => [name, values[index]]))
      const configured = names.filter((_, index) => values[index].trim() !== '')
      const failure = await failureOf(env)

      if (configured.length === 0) {
        // Nothing usable is configured: the documented "build without
        // symbolication" path, even if blank variables are present.
        expect(failure).toBeUndefined()
        const config = await resolveConfig(env)
        expect(config.build.sourcemap).toBe(false)
        expect(sentryPluginOf(config)).toBe(false)
        return
      }

      if (configured.length < names.length) {
        expect(failure).toBeInstanceOf(Error)
        const message = failure?.message ?? ''
        expect(message).toContain('Incomplete Sentry source-map configuration')
        for (const name of names.filter(name => !configured.includes(name))) {
          expect(message).toContain(name)
        }
        for (const name of names) expect(message).not.toContain(credentials[name])
        return
      }

      expect(failure).toBeUndefined()
      const config = await resolveConfig(env)
      expect(config.build.sourcemap).toBe('hidden')
      expect(sentryPluginOf(config)).toBe(true)
    })
  }

  it('trims whitespace around configured credentials before the upload flag sees them', async () => {
    const config = await resolveConfig({
      SENTRY_AUTH_TOKEN: '  fixture-token-never-log  ',
      SENTRY_ORG: '\tfriendly-city-t9 ',
      SENTRY_PROJECT: ' theporadas-com\n',
    })

    expect(config.build.sourcemap).toBe('hidden')
    expect(sentryPluginOf(config)).toBe(true)
  })
})

describe('Sentry upload release identity (vite build)', () => {
  const credentials = {
    SENTRY_AUTH_TOKEN: 'fixture-token-never-log',
    SENTRY_ORG: 'friendly-city-t9',
    SENTRY_PROJECT: 'theporadas-com',
  }

  afterEach(() => {
    vi.resetModules()
  })

  it('uses the deploy commit as the release when uploading from production', async () => {
    const config = await resolveConfig({
      ...credentials,
      COMMIT_REF: COMMIT,
      CONTEXT: 'production',
      VITE_APP_VERSION: '2026-04-14-launch',
    })

    expect(releaseOf(config)).toBe(COMMIT)
    expect(config.build.sourcemap).toBe('hidden')
    expect(sentryPluginOf(config)).toBe(true)
  })

  it('refuses to upload from production without a commit ref', async () => {
    const failure = await failureOf({
      ...credentials,
      COMMIT_REF: undefined,
      CONTEXT: 'production',
      VITE_APP_VERSION: '2026-04-14-launch',
    })

    expect(failure).toBeInstanceOf(Error)
    expect(failure?.message).toContain('COMMIT_REF')
    expect(failure?.message).not.toContain(credentials.SENTRY_AUTH_TOKEN)
  })

  it('refuses to upload from a Netlify deploy when the commit ref is whitespace', async () => {
    const failure = await failureOf({ ...credentials, COMMIT_REF: '   ', NETLIFY: 'true' })

    expect(failure).toBeInstanceOf(Error)
    expect(failure?.message).toContain('COMMIT_REF')
  })

  it('refuses to upload from a deploy preview without a commit ref', async () => {
    const failure = await failureOf({
      ...credentials,
      COMMIT_REF: undefined,
      CONTEXT: 'deploy-preview',
    })

    expect(failure).toBeInstanceOf(Error)
    expect(failure?.message).toContain('COMMIT_REF')
  })

  it('allows a credential-free production build without a commit ref', async () => {
    const config = await resolveConfig({
      COMMIT_REF: undefined,
      CONTEXT: 'production',
      VITE_APP_VERSION: undefined,
    })

    expect(config.build.sourcemap).toBe(false)
    expect(sentryPluginOf(config)).toBe(false)
    expect(releaseOf(config)).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('allows a credentialed local build and labels it with VITE_APP_VERSION', async () => {
    const config = await resolveConfig({
      ...credentials,
      COMMIT_REF: undefined,
      CONTEXT: undefined,
      NETLIFY: undefined,
      VITE_APP_VERSION: 'local-upload-check',
    })

    expect(releaseOf(config)).toBe('local-upload-check')
    expect(config.build.sourcemap).toBe('hidden')
  })

  it('ignores a whitespace-only VITE_APP_VERSION label', async () => {
    const config = await resolveConfig({
      COMMIT_REF: undefined,
      VITE_APP_VERSION: '   ',
    })

    expect(releaseOf(config)).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('trims whitespace around the commit ref', async () => {
    const config = await resolveConfig({ COMMIT_REF: `  ${COMMIT}\n` })

    expect(releaseOf(config)).toBe(COMMIT)
  })
})
