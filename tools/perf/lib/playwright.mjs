/**
 * Playwright loader for the perf harness.
 *
 * Constraint: no new dependencies. The greenfield app already pins
 * `@playwright/test` (and therefore `playwright`) in `rebuild/node_modules`, and
 * the Chromium revision installed for that version is the one Playwright uses in
 * this workspace. The repo root also has an older legacy Playwright; resolving
 * from `rebuild/` first keeps the harness on the version whose browser binaries
 * are actually installed.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { rebuildRoot, HarnessError } from './util.mjs'

async function readPackageVersion(packageJsonPath) {
  try {
    const raw = await readFile(packageJsonPath, 'utf8')
    return JSON.parse(raw).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Resolve and import the Playwright module installed for the greenfield app.
 * @returns {Promise<{chromium: object, version: string, resolvedPath: string}>}
 */
export async function loadPlaywright() {
  const requireFromRebuild = createRequire(path.join(rebuildRoot, 'package.json'))
  const candidates = []

  try {
    const resolved = requireFromRebuild.resolve('playwright')
    candidates.push({ resolved, packageRoot: path.dirname(resolved) })
  } catch {
    // fall through to the repo-root copy
  }

  if (candidates.length === 0) {
    try {
      const requireFromRepo = createRequire(path.join(rebuildRoot, '..', 'package.json'))
      const resolved = requireFromRepo.resolve('playwright')
      candidates.push({ resolved, packageRoot: path.dirname(resolved) })
    } catch {
      throw new HarnessError(
        'Playwright is not installed. Expected rebuild/node_modules/playwright; ' +
          'run `npm ci` in rebuild/ (do not install new packages).'
      )
    }
  }

  const [{ resolved, packageRoot }] = candidates
  const version = await readPackageVersion(path.join(packageRoot, 'package.json'))
  const module_ = await import(pathToFileURL(resolved).href)
  const chromium = module_.chromium ?? module_.default?.chromium
  if (!chromium) throw new HarnessError(`Playwright module at ${resolved} has no chromium export`)

  return { chromium, version, resolvedPath: resolved }
}
