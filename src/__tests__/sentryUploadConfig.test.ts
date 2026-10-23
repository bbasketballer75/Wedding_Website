/**
 * Unit coverage for the shared Sentry build-configuration rules.
 *
 * These functions are consumed by both `vite.config.js` (the build) and
 * `scripts/verify-release-env.js` (`verify:env`). The integration behaviour is
 * covered by src/__tests__/sentryReleaseConfig.test.ts; this file pins the
 * pure rules — presence normalization, deploy detection, release identity —
 * across every combination, including the blank/whitespace ones that used to
 * disagree between the guard and the upload flag.
 */
import { describe, it, expect } from 'vitest'
import {
  SENTRY_UPLOAD_VARIABLES,
  incompleteSentryConfigMessage,
  inspectSentryUploadConfig,
  isDeployBuild,
  normalizeEnvValue,
  resolveReleaseIdentity,
  resolveSentryBuildConfig,
} from '../../scripts/lib/sentry-upload-config.js'

const CREDENTIALS = {
  SENTRY_AUTH_TOKEN: 'fixture-token-never-log',
  SENTRY_ORG: 'fixture-org-never-log',
  SENTRY_PROJECT: 'fixture-project-never-log',
} as const

const NAMES = SENTRY_UPLOAD_VARIABLES as ReadonlyArray<keyof typeof CREDENTIALS>

describe('normalizeEnvValue', () => {
  it('treats unset, empty, and whitespace-only as absent', () => {
    expect(normalizeEnvValue(undefined)).toBe('')
    expect(normalizeEnvValue('')).toBe('')
    expect(normalizeEnvValue('   ')).toBe('')
    expect(normalizeEnvValue('\t\n ')).toBe('')
  })

  it('trims a real value without altering it', () => {
    expect(normalizeEnvValue('  value  ')).toBe('value')
  })
})

describe('inspectSentryUploadConfig', () => {
  const states = [
    ['real', 'value'],
    ['empty', ''],
    ['whitespace', '  '],
  ] as const

  for (const [aLabel, aValue] of states) {
    for (const [bLabel, bValue] of states) {
      for (const [cLabel, cValue] of states) {
        const label = `${aLabel}/${bLabel}/${cLabel}`
        const values = [aValue, bValue, cValue]
        const env = Object.fromEntries(NAMES.map((name, index) => [name, values[index]]))
        const configured = NAMES.filter((_, index) => values[index].trim() !== '')

        it(`classifies ${label}`, () => {
          const result = inspectSentryUploadConfig(env)

          expect(result.present).toEqual(configured)
          expect(result.missing).toEqual(NAMES.filter(name => !configured.includes(name)))
          expect(result.uploadEnabled).toBe(configured.length === NAMES.length)
          expect(result.partial).toBe(configured.length > 0 && configured.length < NAMES.length)
        })
      }
    }
  }

  it('reports every variable missing for an empty environment', () => {
    const result = inspectSentryUploadConfig({})

    expect(result.uploadEnabled).toBe(false)
    expect(result.partial).toBe(false)
    expect(result.missing).toEqual([...NAMES])
  })
})

describe('isDeployBuild', () => {
  it.each(['production', 'deploy-preview', 'branch-deploy'])(
    'recognises the %s context',
    context => {
      expect(isDeployBuild({ CONTEXT: context })).toBe(true)
    }
  )

  it('recognises a Netlify environment', () => {
    expect(isDeployBuild({ NETLIFY: 'true' })).toBe(true)
  })

  it.each([
    ['local build', {}],
    ['dev context', { CONTEXT: 'dev' }],
    ['blank context', { CONTEXT: '   ' }],
    ['NETLIFY=false', { NETLIFY: 'false' }],
    ['blank NETLIFY', { NETLIFY: '  ' }],
  ])('does not treat %s as a deploy', (_label, env) => {
    expect(isDeployBuild(env)).toBe(false)
  })
})

describe('resolveReleaseIdentity', () => {
  const COMMIT = 'ffc68009edc0772c42bb721df5d7a265b376d157'

  it('prefers the commit ref and marks it unique per deploy', () => {
    const release = resolveReleaseIdentity({
      COMMIT_REF: `  ${COMMIT}  `,
      VITE_APP_VERSION: 'static-label',
    })

    expect(release.releaseVersion).toBe(COMMIT)
    expect(release.source).toBe('commit')
    expect(release.uniquePerDeploy).toBe(true)
  })

  it('falls back to the trimmed label without claiming per-deploy uniqueness', () => {
    const release = resolveReleaseIdentity({ COMMIT_REF: '   ', VITE_APP_VERSION: ' local ' })

    expect(release.releaseVersion).toBe('local')
    expect(release.source).toBe('label')
    expect(release.uniquePerDeploy).toBe(false)
  })

  it('falls back to the package version when the label is blank', () => {
    const release = resolveReleaseIdentity({ VITE_APP_VERSION: '   ' }, '1.2.3')

    expect(release.releaseVersion).toBe('1.2.3')
    expect(release.source).toBe('package')
    expect(release.uniquePerDeploy).toBe(false)
  })
})

describe('resolveSentryBuildConfig', () => {
  it('refuses a partial set and leaks no values', () => {
    const env = { SENTRY_AUTH_TOKEN: CREDENTIALS.SENTRY_AUTH_TOKEN }

    expect(() => resolveSentryBuildConfig(env)).toThrow(
      /Incomplete Sentry source-map configuration/
    )
    try {
      resolveSentryBuildConfig(env)
    } catch (error) {
      const message = (error as Error).message
      for (const name of NAMES) expect(message).not.toContain(CREDENTIALS[name])
      expect(message).toContain('SENTRY_ORG')
      expect(message).toContain('SENTRY_PROJECT')
    }
  })

  it('refuses a deploy build that would upload under a constant release', () => {
    const env = { ...CREDENTIALS, CONTEXT: 'production', VITE_APP_VERSION: 'static-label' }

    expect(() => resolveSentryBuildConfig(env)).toThrow(/COMMIT_REF/)
    try {
      resolveSentryBuildConfig(env)
    } catch (error) {
      const message = (error as Error).message
      for (const name of NAMES) expect(message).not.toContain(CREDENTIALS[name])
    }
  })

  it('allows a deploy build that uploads under the deploy commit', () => {
    const config = resolveSentryBuildConfig(
      { ...CREDENTIALS, CONTEXT: 'production', COMMIT_REF: 'abc123' },
      '0.0.0'
    )

    expect(config.uploadEnabled).toBe(true)
    expect(config.releaseVersion).toBe('abc123')
    expect(config.deployBuild).toBe(true)
  })

  it('allows a credentialed local build without a commit ref', () => {
    const config = resolveSentryBuildConfig(
      { ...CREDENTIALS, VITE_APP_VERSION: 'local-upload-check' },
      '0.0.0'
    )

    expect(config.uploadEnabled).toBe(true)
    expect(config.deployBuild).toBe(false)
    expect(config.releaseVersion).toBe('local-upload-check')
  })

  it('leaves a credential-free environment building without symbolication', () => {
    const config = resolveSentryBuildConfig({ CONTEXT: 'production' }, '0.0.0')

    expect(config.uploadEnabled).toBe(false)
    expect(config.partial).toBe(false)
    expect(config.releaseVersion).toBe('0.0.0')
  })
})

describe('incompleteSentryConfigMessage', () => {
  it('names only the missing variables', () => {
    const message = incompleteSentryConfigMessage(['SENTRY_ORG'])

    expect(message).toContain('missing SENTRY_ORG.')
    expect(message).toContain('Set all of SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT')
  })
})
