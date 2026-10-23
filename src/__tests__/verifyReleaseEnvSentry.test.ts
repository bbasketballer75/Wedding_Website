/**
 * Exit-code coverage for `npm run verify:env`'s Sentry gate.
 *
 * `scripts/verify-release-env.js` runs before the build on every Netlify
 * deploy. It used to ignore SENTRY_* entirely, so a half-configured environment
 * passed `verify:env` and only failed one step later inside `vite build`. These
 * tests run the real script as a child process and assert its actual exit code
 * and output — not a reimplementation of its logic.
 *
 * Each case runs in a throwaway working directory with a fixture .env.example,
 * so the developer's real .env can never influence the result and no
 * credentials are read or written.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()
const SCRIPT = path.resolve(REPO_ROOT, 'scripts/verify-release-env.js')

const ENV_EXAMPLE = [
  'VITE_SUPABASE_URL=',
  'VITE_SUPABASE_ANON_KEY=',
  'VITE_SITE_URL=',
  'VITE_MEDIA_BASE_URL=',
  '# SENTRY_AUTH_TOKEN=',
  '# SENTRY_ORG=',
  '# SENTRY_PROJECT=',
  '',
].join('\n')

const FIXTURE = {
  SENTRY_AUTH_TOKEN: 'fixture-token-never-log',
  SENTRY_ORG: 'fixture-org-never-log',
  SENTRY_PROJECT: 'fixture-project-never-log',
}

/** Ambient variables that must not leak into the child process. */
const SCRUBBED = [
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'COMMIT_REF',
  'CONTEXT',
  'NETLIFY',
  'VITE_APP_VERSION',
  'VITE_SENTRY_DSN',
  'VITE_GA_ID',
  'VITE_SITE_URL',
  'VITE_MEDIA_BASE_URL',
]

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'verify-release-env-'))
  writeFileSync(path.join(workdir, '.env.example'), ENV_EXAMPLE)
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

function runVerifyEnv(overrides: Record<string, string>): {
  status: number | null
  output: string
} {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !SCRUBBED.includes(key)) env[key] = value
  }
  env.VITE_SUPABASE_URL = 'https://fixture.supabase.co'
  env.VITE_SUPABASE_ANON_KEY = 'fixture-anon-key'
  Object.assign(env, overrides)

  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: workdir,
    env,
    encoding: 'utf8',
    timeout: 60_000,
  })

  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe('verify:env Sentry source-map gate', () => {
  it('passes and reports the upload as disabled when no credentials are set', () => {
    const { status, output } = runVerifyEnv({})

    expect(status).toBe(0)
    expect(output).toContain('Sentry source-map upload is disabled')
  })

  it('passes when all three credentials are set for a deploy with a commit ref', () => {
    const { status, output } = runVerifyEnv({
      ...FIXTURE,
      CONTEXT: 'production',
      COMMIT_REF: 'ffc68009edc0772c42bb721df5d7a265b376d157',
    })

    expect(status).toBe(0)
    expect(output).toContain('Sentry source-map upload credentials are configured (3 of 3)')
  })

  it('fails on a partial set, naming the missing variables and no values', () => {
    const { status, output } = runVerifyEnv({ SENTRY_AUTH_TOKEN: FIXTURE.SENTRY_AUTH_TOKEN })

    expect(status).toBe(1)
    expect(output).toContain(
      'Incomplete Sentry source-map configuration: missing SENTRY_ORG, SENTRY_PROJECT'
    )
    for (const value of Object.values(FIXTURE)) expect(output).not.toContain(value)
  })

  it('treats a whitespace-only credential as missing', () => {
    const { status, output } = runVerifyEnv({
      SENTRY_AUTH_TOKEN: '   ',
      SENTRY_ORG: FIXTURE.SENTRY_ORG,
      SENTRY_PROJECT: FIXTURE.SENTRY_PROJECT,
    })

    expect(status).toBe(1)
    expect(output).toContain('missing SENTRY_AUTH_TOKEN')
  })

  it('treats an all-whitespace triple as no configuration and passes', () => {
    const { status, output } = runVerifyEnv({
      SENTRY_AUTH_TOKEN: ' ',
      SENTRY_ORG: '  ',
      SENTRY_PROJECT: '   ',
      CONTEXT: 'production',
    })

    expect(status).toBe(0)
    expect(output).toContain('Sentry source-map upload is disabled')
  })

  it('fails when a deploy would upload under a constant release', () => {
    const { status, output } = runVerifyEnv({
      ...FIXTURE,
      CONTEXT: 'production',
      VITE_APP_VERSION: '2026-04-14-launch',
    })

    expect(status).toBe(1)
    expect(output).toContain('COMMIT_REF is not set')
    for (const value of Object.values(FIXTURE)) expect(output).not.toContain(value)
  })

  it('fails on a Netlify deploy whose commit ref is whitespace', () => {
    const { status, output } = runVerifyEnv({ ...FIXTURE, NETLIFY: 'true', COMMIT_REF: '   ' })

    expect(status).toBe(1)
    expect(output).toContain('COMMIT_REF is not set')
  })

  it('is wired into the verify:env gate that Netlify runs before the build', () => {
    const packageJson = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const netlifyToml = readFileSync(path.join(REPO_ROOT, 'netlify.toml'), 'utf8')

    expect(packageJson.scripts['verify:env']).toContain('verify-release-env.js')
    expect(netlifyToml).toContain('npm run verify:env && npm run build')
  })
})
