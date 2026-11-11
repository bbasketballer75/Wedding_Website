#!/usr/bin/env node
/**
 * Validates the committed contracts that define the rebuild's target:
 * routes, features, UI matrix, SEO/PWA, media, fixtures, content and the
 * database schema baseline.
 *
 * Usage:
 *   node tools/verify-contracts.mjs                  # strict (CI + checkpoints)
 *   node tools/verify-contracts.mjs --allow-missing  # early workbench mode
 *   node tools/verify-contracts.mjs --json
 *
 * Exit codes: 0 valid (or only missing files while --allow-missing), 1 invalid.
 */
import path from 'node:path'
import { fileExists, listFiles, readJson } from './lib/fs.mjs'
import {
  contractsDir,
  contentDir,
  fixturesDir,
  renderedContentDir,
  schemaDir,
} from './lib/paths.mjs'
import {
  JSON_CONTRACTS,
  REQUIRED_CONTENT,
  REQUIRED_FIXTURES,
  REQUIRED_SCHEMA_FILES,
} from './lib/schemas.mjs'
import { fail, info, ok, step, warn } from './lib/log.mjs'

const args = new Set(process.argv.slice(2))
const ALLOW_MISSING = args.has('--allow-missing')
const JSON_OUTPUT = args.has('--json')

const problems = []
const warnings = []
const missing = []
const stats = { contracts: 0, fixtures: 0, content: 0, schemaFiles: 0, renderedRoutes: 0 }

function problem(message) {
  problems.push(message)
  if (!JSON_OUTPUT) fail(message)
}

function missingFile(label) {
  missing.push(label)
  if (!JSON_OUTPUT) warn(`not generated yet: ${label}`)
}

async function loadJsonContract(file, schema) {
  const fullPath = path.join(contractsDir, file)
  if (!(await fileExists(fullPath))) return { status: 'missing' }

  try {
    const parsed = schema.safeParse(await readJson(fullPath))
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 8)) {
        problem(`contracts/${file}: ${issue.path.join('.') || '<root>'} — ${issue.message}`)
      }
      return { status: 'invalid' }
    }
    stats.contracts += 1
    return { status: 'ok', data: parsed.data }
  } catch (error) {
    problem(`contracts/${file}: invalid JSON (${error.message})`)
    return { status: 'invalid' }
  }
}

function routeIsKnown(candidate, routePaths) {
  if (routePaths.has(candidate)) return true

  const candidateSegments = candidate.split('/').filter(Boolean)

  for (const pattern of routePaths) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2)
      if (candidate === prefix || candidate.startsWith(`${prefix}/`)) return true
      continue
    }

    if (!pattern.includes(':')) continue

    const patternSegments = pattern.split('/').filter(Boolean)
    if (patternSegments.length !== candidateSegments.length) continue
    const matches = patternSegments.every(
      (segment, index) => segment.startsWith(':') || segment === candidateSegments[index]
    )
    if (matches) return true
  }

  return false
}

// ────────────────────────────────────────────────────────────────────────────
// 1. JSON contracts
// ────────────────────────────────────────────────────────────────────────────
if (!JSON_OUTPUT) step('Contracts')

const loaded = {}
for (const { file, schema, required } of JSON_CONTRACTS) {
  const result = await loadJsonContract(file, schema)

  if (result.status === 'missing') {
    if (required) {
      missingFile(`contracts/${file}`)
    } else {
      if (!JSON_OUTPUT) info(`optional, not generated yet: contracts/${file}`)
    }
    continue
  }

  if (result.status === 'ok') {
    loaded[file] = result.data
    if (!JSON_OUTPUT) ok(`contracts/${file}`)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Cross-references between contracts
// ────────────────────────────────────────────────────────────────────────────
if (!JSON_OUTPUT) step('Cross-references')

const routes = loaded['routes.json']?.routes ?? null
const features = loaded['features.json']?.features ?? null
const ui = loaded['ui.json'] ?? null
const seo = loaded['seo-pwa.json'] ?? null
const allowlist = loaded['parity-allowlist.json']?.entries ?? null

if (routes) {
  const paths = new Set()
  for (const route of routes) {
    if (paths.has(route.path)) problem(`routes.json: duplicate route path ${route.path}`)
    paths.add(route.path)
  }

  if (!JSON_OUTPUT) ok(`${paths.size} unique routes`)

  if (features) {
    let checked = 0
    for (const feature of features) {
      for (const featureRoute of feature.routes) {
        checked += 1
        if (!routeIsKnown(featureRoute, paths)) {
          problem(`features.json: ${feature.id} references unknown route ${featureRoute}`)
        }
      }
    }
    if (!JSON_OUTPUT) ok(`${checked} feature route references resolve`)
  }

  if (ui) {
    const uiThemes = new Set(ui.themes)
    for (const route of routes) {
      for (const theme of route.themes) {
        if (!uiThemes.has(theme))
          problem(`routes.json: ${route.id} uses theme ${theme} not in ui.json`)
      }
    }
  }

  if (seo) {
    for (const entry of seo.sitemap) {
      if (!routeIsKnown(entry.path, paths)) {
        problem(`seo-pwa.json: sitemap path ${entry.path} is not a known route`)
      }
    }
    for (const meta of seo.routes) {
      if (!routeIsKnown(meta.canonicalPath, paths)) {
        problem(`seo-pwa.json: meta canonicalPath ${meta.canonicalPath} is not a known route`)
      }
    }
  }

  if (allowlist) {
    for (const entry of allowlist) {
      if (!routeIsKnown(entry.route, paths)) {
        problem(`parity-allowlist.json: unknown route ${entry.route}`)
      }
      if (entry.expiresAtWave > 9) {
        problem(
          `parity-allowlist.json: ${entry.route} expiry wave ${entry.expiresAtWave} is beyond the roadmap`
        )
      }
    }
  }

  const priorityOne = routes.filter(route => route.parity === 1)
  if (priorityOne.length === 0) problem('routes.json: no parity priority-1 routes declared')
  if (!JSON_OUTPUT) ok(`${priorityOne.length} parity priority-1 routes`)
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Fixtures
// ────────────────────────────────────────────────────────────────────────────
if (!JSON_OUTPUT) step('Fixtures')
for (const fixture of REQUIRED_FIXTURES) {
  const fullPath = path.join(fixturesDir, fixture)
  if (!(await fileExists(fullPath))) {
    missingFile(`contracts/fixtures/${fixture}`)
    continue
  }
  try {
    await readJson(fullPath)
    stats.fixtures += 1
    if (!JSON_OUTPUT) ok(`contracts/fixtures/${fixture}`)
  } catch (error) {
    problem(`contracts/fixtures/${fixture}: invalid JSON (${error.message})`)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Content
// ────────────────────────────────────────────────────────────────────────────
if (!JSON_OUTPUT) step('Content')
for (const contentFile of REQUIRED_CONTENT) {
  const fullPath = path.join(contentDir, contentFile)
  if (!(await fileExists(fullPath))) {
    missingFile(`contracts/content/${contentFile}`)
    continue
  }
  try {
    await readJson(fullPath)
    stats.content += 1
    if (!JSON_OUTPUT) ok(`contracts/content/${contentFile}`)
  } catch (error) {
    problem(`contracts/content/${contentFile}: invalid JSON (${error.message})`)
  }
}

if (await fileExists(renderedContentDir)) {
  const rendered = await listFiles(renderedContentDir)
  stats.renderedRoutes = rendered.filter(file => file.endsWith('.json')).length
  if (stats.renderedRoutes === 0) problem('contracts/content/rendered: no rendered-copy snapshots')
  if (!JSON_OUTPUT) ok(`${stats.renderedRoutes} rendered route snapshots`)
} else {
  missingFile('contracts/content/rendered/')
}

const manifest = loaded['content/MEDIA_MANIFEST.json']
if (manifest) {
  const remoteWithoutLocal = manifest.media.filter(
    entry => !entry.existsLocally && entry.source === 'public'
  )
  if (remoteWithoutLocal.length > 0) {
    problem(
      `MEDIA_MANIFEST: ${remoteWithoutLocal.length} entries claimed as public but missing locally ` +
        `(first: ${remoteWithoutLocal[0].path})`
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Schema baseline + media inventory
// ────────────────────────────────────────────────────────────────────────────
if (!JSON_OUTPUT) step('Schema baseline')
for (const schemaFile of REQUIRED_SCHEMA_FILES) {
  const fullPath = path.join(schemaDir, schemaFile)
  if (!(await fileExists(fullPath))) {
    missingFile(`contracts/schema/${schemaFile}`)
    continue
  }
  stats.schemaFiles += 1
  if (!JSON_OUTPUT) ok(`contracts/schema/${schemaFile}`)
}

const mediaContract = path.join(contractsDir, 'media', 'CONTRACT.md')
if (!(await fileExists(mediaContract))) {
  missingFile('contracts/media/CONTRACT.md')
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Report
// ────────────────────────────────────────────────────────────────────────────
const strictFailure = problems.length > 0 || (missing.length > 0 && !ALLOW_MISSING)
const payload = {
  ok: !strictFailure,
  allowMissing: ALLOW_MISSING,
  stats,
  problems,
  warnings,
  missing,
}

if (JSON_OUTPUT) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
} else {
  if (missing.length > 0 && !ALLOW_MISSING) {
    fail(
      `${missing.length} required artifact(s) missing — run with --allow-missing while building the workbench`
    )
  }
  if (problems.length > 0) {
    fail(`${problems.length} contract problem(s)`)
  } else {
    ok(
      `contracts valid: ${stats.contracts} json contracts, ${stats.fixtures} fixtures, ` +
        `${stats.content} content files, ${stats.renderedRoutes} rendered routes, ` +
        `${stats.schemaFiles} schema artifacts`
    )
  }
}

process.exit(strictFailure ? 1 : 0)
