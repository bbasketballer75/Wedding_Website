/**
 * Shared rules for the build-time Sentry source-map upload.
 *
 * Three consumers must agree on what "configured" means, and they used to
 * disagree subtly:
 *
 *   - vite.config.js                — build gate (throws, fails the build)
 *   - scripts/verify-release-env.js — `verify:env`, the gate before the build
 *   - src/__tests__/…               — regression coverage
 *
 * Presence is normalized through `trim()` exactly once, so an unset, empty, or
 * whitespace-only variable is absent to every consumer. Without that, a
 * whitespace-only triple passed the trim()-based guard while the raw-truthiness
 * upload flag turned on and uploaded with blank credentials.
 *
 * Nothing here reads files or credentials from disk; every function takes the
 * environment it should inspect, and no error message ever interpolates a
 * variable VALUE — only variable names.
 */

export const SENTRY_UPLOAD_VARIABLES = Object.freeze([
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
])

/**
 * Netlify deploy contexts in which the build actually ships the site. In these
 * a source-map upload must be tied to the commit being deployed: a static
 * label or the package version is not a per-deploy identity, so uploading
 * under it would attribute errors to the wrong build.
 */
const DEPLOY_CONTEXTS = ['production', 'deploy-preview', 'branch-deploy']

/** Trimmed string for a variable, or '' when it is unset/not a string. */
export function normalizeEnvValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The three credentials as the uploader must receive them.
 *
 * Presence checks and the plugin used to normalize independently: the gate
 * trimmed, the plugin got raw `process.env`, so a padded value passed the gate
 * and reached Sentry with the padding. Returning the normalized values here
 * makes one trimming step feed both.
 */
export function normalizeSentryCredentials(env = process.env) {
  return {
    authToken: normalizeEnvValue(env.SENTRY_AUTH_TOKEN),
    org: normalizeEnvValue(env.SENTRY_ORG),
    project: normalizeEnvValue(env.SENTRY_PROJECT),
  }
}

/** True when the environment is a Netlify deploy rather than a local build. */
export function isDeployBuild(env = process.env) {
  if (normalizeEnvValue(env.NETLIFY).toLowerCase() === 'true') return true
  return DEPLOY_CONTEXTS.includes(normalizeEnvValue(env.CONTEXT))
}

/**
 * Classify the three upload variables without throwing.
 *
 * `partial` is the condition the build must refuse: some names configured,
 * others absent. Callers decide whether that is a thrown error (vite build) or
 * a reported failure (`verify:env`).
 */
export function inspectSentryUploadConfig(env = process.env) {
  const present = []
  const missing = []

  for (const variable of SENTRY_UPLOAD_VARIABLES) {
    if (normalizeEnvValue(env[variable])) present.push(variable)
    else missing.push(variable)
  }

  return {
    present,
    missing,
    uploadEnabled: missing.length === 0,
    partial: present.length > 0 && missing.length > 0,
  }
}

/** Error text naming only the missing variables (never their values). */
export function incompleteSentryConfigMessage(missing) {
  return (
    `Incomplete Sentry source-map configuration: missing ${missing.join(', ')}. ` +
    `Set all of ${SENTRY_UPLOAD_VARIABLES.join(', ')} to upload source maps, ` +
    'or remove them all to build without symbolication.'
  )
}

/**
 * Release identity for a build.
 *
 * Order: deploy commit ref (unique per deploy) → optional label (local builds)
 * → package version. Whitespace around any of them is trimmed, and a
 * whitespace-only label is treated as absent instead of becoming the release.
 */
export function resolveReleaseIdentity(env = process.env, packageVersion = '0.0.0') {
  const commitRef = normalizeEnvValue(env.COMMIT_REF)
  const label = normalizeEnvValue(env.VITE_APP_VERSION)
  const source = commitRef ? 'commit' : label ? 'label' : 'package'

  return {
    releaseVersion: commitRef || label || packageVersion,
    source,
    uniquePerDeploy: source === 'commit',
  }
}

export function missingReleaseIdentityMessage(env = process.env) {
  const context = normalizeEnvValue(env.CONTEXT)
  const where = context ? `a ${context} deploy` : 'a deploy build'
  return (
    `Refusing to upload Sentry source maps for ${where} without a unique release identity: ` +
    'COMMIT_REF is not set. Netlify supplies COMMIT_REF on every deploy; ' +
    'set it, or unset SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT to build without symbolication.'
  )
}

/**
 * Full build-time resolution. Throws when the environment is inconsistent, so
 * a misconfigured deploy fails loudly instead of shipping an unsymbolicated
 * or wrongly-attributed release.
 */
export function resolveSentryBuildConfig(env = process.env, packageVersion = '0.0.0') {
  const upload = inspectSentryUploadConfig(env)

  if (upload.partial) {
    throw new Error(incompleteSentryConfigMessage(upload.missing))
  }

  const release = resolveReleaseIdentity(env, packageVersion)
  const deployBuild = isDeployBuild(env)

  if (upload.uploadEnabled && deployBuild && !release.uniquePerDeploy) {
    throw new Error(missingReleaseIdentityMessage(env))
  }

  return {
    ...upload,
    ...release,
    deployBuild,
    credentials: normalizeSentryCredentials(env),
  }
}
