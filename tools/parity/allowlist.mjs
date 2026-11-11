/**
 * parity-allowlist.json loading and evaluation.
 *
 * An allowlist entry is a reviewed, expiring exception for ONE route/viewport/
 * theme combination with an explicit maximum changed-pixel ratio. It can never
 * exempt text/DOM drift or a capture error — those always fail a wave.
 */
import { HarnessError, pathExists, readJsonFile } from './util.mjs'

export const ALLOWLIST_VIEWPORTS = ['desktop', 'mobile']
export const ALLOWLIST_THEMES = ['dark', 'light']

function validateEntry(entry, index, file) {
  if (!entry || typeof entry !== 'object') {
    throw new HarnessError(`${file}: entries[${index}] must be an object`)
  }
  if (typeof entry.route !== 'string' || entry.route.length === 0) {
    throw new HarnessError(`${file}: entries[${index}].route is required`)
  }
  if (!ALLOWLIST_VIEWPORTS.includes(entry.viewport)) {
    throw new HarnessError(`${file}: entries[${index}].viewport must be desktop or mobile`)
  }
  if (!ALLOWLIST_THEMES.includes(entry.theme)) {
    throw new HarnessError(`${file}: entries[${index}].theme must be dark or light`)
  }
  if (typeof entry.reason !== 'string' || entry.reason.trim().length === 0) {
    throw new HarnessError(`${file}: entries[${index}].reason is required (reviewed justification)`)
  }
  if (!Number.isInteger(entry.expiresAtWave) || entry.expiresAtWave <= 0) {
    throw new HarnessError(
      `${file}: entries[${index}].expiresAtWave must be a positive integer wave`
    )
  }
  if (
    typeof entry.maxDiffPixelRatio !== 'number' ||
    entry.maxDiffPixelRatio < 0 ||
    entry.maxDiffPixelRatio > 1
  ) {
    throw new HarnessError(`${file}: entries[${index}].maxDiffPixelRatio must be between 0 and 1`)
  }
  return {
    route: entry.route,
    viewport: entry.viewport,
    theme: entry.theme,
    reason: entry.reason.trim(),
    expiresAtWave: entry.expiresAtWave,
    maxDiffPixelRatio: entry.maxDiffPixelRatio,
  }
}

export async function loadAllowlist(file) {
  if (!(await pathExists(file))) {
    return { entries: [], source: 'missing', file, warnings: [`Allowlist file not found: ${file}`] }
  }
  const raw = await readJsonFile(file)
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) {
    throw new HarnessError(`${file} must have shape { "entries": [] } (parityAllowlistSchema)`)
  }
  const entries = raw.entries.map((entry, index) => validateEntry(entry, index, file))
  return { entries, source: file, file, warnings: [] }
}

/**
 * Match a shot against the allowlist.
 * `wave` is the current rebuild wave; an entry expires when wave > expiresAtWave.
 */
export function evaluateAllowlist({ allowlist, route, viewport, theme, ratio, wave }) {
  const entries = allowlist?.entries ?? []
  const matches = entries.filter(
    entry =>
      (entry.route === route.id || entry.route === route.path) &&
      entry.viewport === viewport &&
      entry.theme === theme
  )
  const expired = matches.filter(entry => wave > entry.expiresAtWave)
  const active = matches
    .filter(entry => wave <= entry.expiresAtWave)
    .sort((a, b) => a.maxDiffPixelRatio - b.maxDiffPixelRatio)
  const accepted = active.find(entry => ratio <= entry.maxDiffPixelRatio) ?? null
  let status = 'no-entry'
  if (accepted) status = 'allowed'
  else if (active.length > 0) status = 'over-entry-limit'
  else if (expired.length > 0) status = 'expired'
  return {
    status,
    accepted: Boolean(accepted),
    entry: accepted,
    activeEntries: active.length,
    expiredEntries: expired,
    wave,
  }
}
