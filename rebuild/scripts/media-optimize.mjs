#!/usr/bin/env node
/* global console, process, URL */
/**
 * Media derivative pipeline (Wave 8 W8-2).
 *
 * Generates AVIF/WebP/JPEG derivatives at the frozen breakpoint widths for the
 * archive's local `/images/**` sources and records them in
 * `src/shared/media/media-manifest.json` (which `OptimizedImage` consumes).
 *
 * The deploy is self-contained: derivatives are written under
 * `rebuild/public/images/optimized/**`; the legacy `public/images/**` sources
 * are read-only inputs and are never copied, symlinked or modified.
 *
 * Commands:
 *   node scripts/media-optimize.mjs --plan      # enumerate + planned outputs (no deps)
 *   node scripts/media-optimize.mjs --check     # fail when derivatives are missing/stale (no deps)
 *   node scripts/media-optimize.mjs --all       # generate everything in the configured scope
 *   node scripts/media-optimize.mjs --only home/,film/   # generate an approved subset
 *
 * `--plan` and `--check` only parse raster headers (PNG/JPEG/WebP) and hashes —
 * they work before `sharp` is installed. Generation requires the pinned devDep:
 *
 *   npm install --save-dev --save-exact sharp@0.35.5      (Lead owns installs)
 *
 * Exit codes: 0 ok, 1 check failures, 2 usage/IO error.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_MEDIA_PIPELINE_CONFIG,
  canonicalConfigJson,
  createManifestEntry,
  expectedDerivativeFiles,
  parseMediaPipelineConfig,
  planSourceDerivatives,
  readImageDimensions,
  serializeMediaManifest,
} from '../src/shared/media/media-pipeline.ts'
import { parseMediaManifest } from '../src/shared/media/media-manifest.ts'

const REBUILD_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEFAULT_CONFIG_PATH = join(REBUILD_ROOT, 'perf', 'media.config.json')
const RASTER_EXTENSION = /\.(png|jpe?g|webp)$/i

const HELP = `Usage: node scripts/media-optimize.mjs [action] [options]

Actions:
  --plan                 Enumerate sources and print the planned derivative set (default)
  --check                Verify the manifest and every derivative file (exit 1 on drift)
  --generate             Generate derivatives (requires sharp; use --all or --only)

Scope / safety:
  --all                  Explicitly allow generating the full configured scope
  --only <csv>           Only sources whose relative path contains one of the values
  --from-contract <file> Restrict to local /images paths listed in a MEDIA_MANIFEST.json
  --limit <n>            Process at most n sources (dry-run/validation helper)

Options:
  --config <file>        Pipeline config (default: rebuild/perf/media.config.json)
  --src <dir>            Source directory override (default: ../public/images)
  --out <dir>            Output directory override (default: public/images/optimized)
  --manifest <file>      Manifest path override (default: src/shared/media/media-manifest.json)
  --force                Re-encode even when derivatives are fresh
  --prune                Delete derivative files not referenced by the manifest
  --json                 Machine-readable summary on stdout
  --help                 Show this help
`

function parseArgs(argv) {
  const options = {
    action: 'plan',
    config: DEFAULT_CONFIG_PATH,
    sourceDir: null,
    outputDir: null,
    manifestPath: null,
    all: false,
    only: [],
    fromContract: null,
    limit: null,
    force: false,
    prune: false,
    json: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const next = () => {
      const value = argv[++index]
      if (value === undefined) throw new Error(`${arg} requires a value`)
      return value
    }
    switch (arg) {
      case '--plan':
        options.action = 'plan'
        break
      case '--check':
        options.action = 'check'
        break
      case '--generate':
        options.action = 'generate'
        break
      case '--all':
        options.all = true
        break
      case '--only':
        options.only = next()
          .split(',')
          .map(value => value.trim())
          .filter(Boolean)
        break
      case '--from-contract':
        options.fromContract = resolve(REBUILD_ROOT, next())
        break
      case '--limit':
        options.limit = Number.parseInt(next(), 10)
        if (!Number.isInteger(options.limit) || options.limit <= 0) {
          throw new Error('--limit must be a positive integer')
        }
        break
      case '--config':
        options.config = resolve(REBUILD_ROOT, next())
        break
      case '--src':
        options.sourceDir = next()
        break
      case '--out':
        options.outputDir = next()
        break
      case '--manifest':
        options.manifestPath = next()
        break
      case '--force':
        options.force = true
        break
      case '--prune':
        options.prune = true
        break
      case '--json':
        options.json = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`unknown option ${arg}`)
    }
  }

  return options
}

function loadConfig(options) {
  let raw = {}
  if (existsSync(options.config)) {
    raw = JSON.parse(readFileSync(options.config, 'utf8'))
  } else if (options.config !== DEFAULT_CONFIG_PATH) {
    throw new Error(`config not found: ${options.config}`)
  }
  const config = parseMediaPipelineConfig({
    ...DEFAULT_MEDIA_PIPELINE_CONFIG,
    ...raw,
    ...(options.sourceDir ? { sourceDir: options.sourceDir } : {}),
    ...(options.outputDir ? { outputDir: options.outputDir } : {}),
    ...(options.manifestPath ? { manifestPath: options.manifestPath } : {}),
    ...(options.only.length > 0 ? { include: options.only } : {}),
  })
  return config
}

function walkRasters(dir, baseDir = dir) {
  const files = []
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkRasters(fullPath, baseDir))
    else if (entry.isFile() && RASTER_EXTENSION.test(entry.name)) {
      files.push(relative(baseDir, fullPath).split('\\').join('/'))
    }
  }
  return files.sort()
}

function loadContractPaths(contractPath) {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  const media = Array.isArray(contract.media) ? contract.media : []
  return new Set(
    media
      .map(item => item.path)
      .filter(path => typeof path === 'string' && path.startsWith('/images/'))
      .map(path => path.slice('/images/'.length))
  )
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function isFresh(entry, sourceSha, configHash, expectedFiles, root) {
  if (!entry) return false
  if (entry.sourceSha256 !== sourceSha || entry.configHash !== configHash) return false
  for (const file of expectedFiles) {
    const absolute = join(root, file.filePath)
    if (!existsSync(absolute) || statSync(absolute).size !== file.bytes) return false
  }
  return true
}

function planAll(sources, config) {
  const plans = []
  for (const relativePath of sources) {
    const absolute = join(resolve(REBUILD_ROOT, config.sourceDir), relativePath)
    const bytes = readFileSync(absolute)
    const dimensions = readImageDimensions(bytes)
    plans.push({
      plan: planSourceDerivatives(
        {
          relativePath,
          width: dimensions.width,
          height: dimensions.height,
          format: dimensions.format,
        },
        config
      ),
      sourceBytes: bytes.length,
      buffer: bytes,
    })
  }
  return plans
}

function summarizePlan(plans, config) {
  const byRange = {}
  const byFormat = { avif: 0, webp: 0, jpg: 0 }
  let plannedFiles = 0
  let sourceBytes = 0
  for (const item of plans) {
    const top = item.plan.relativePath.split('/')[0] ?? 'root'
    byRange[top] = (byRange[top] ?? 0) + 1
    sourceBytes += item.sourceBytes
    for (const derivative of item.plan.derivatives) {
      byFormat[derivative.format] = (byFormat[derivative.format] ?? 0) + 1
      plannedFiles++
    }
  }
  return {
    sources: plans.length,
    sourceMiB: Math.round((sourceBytes / (1024 * 1024)) * 10) / 10,
    plannedFiles,
    byRange,
    byFormat,
    widths: config.widths,
    formats: config.formats,
    outputDir: config.outputDir,
    manifestPath: config.manifestPath,
  }
}

function ensureApproval(options, config) {
  const approved =
    options.all ||
    options.only.length > 0 ||
    options.fromContract !== null ||
    (Array.isArray(config.include) && config.include.length > 0)
  if (!approved) {
    throw new Error(
      [
        'refusing to generate without an approved scope (generated images are committed to',
        'rebuild/public/images/**). Pass --all, --only <substr>, --from-contract <file>, or set',
        'include patterns in rebuild/perf/media.config.json. Run --plan first to review sizes.',
      ].join(' ')
    )
  }
}

async function loadSharp() {
  try {
    const module = await import('sharp')
    return module.default
  } catch {
    throw new Error(
      [
        'sharp is not installed. This is a sizeable native devDependency and is Lead-owned:',
        '  ask the Lead to run: npm install --save-dev --save-exact sharp@0.35.5',
        '--plan and --check work without sharp.',
      ].join(' ')
    )
  }
}

function rgbToHex({ r, g, b }) {
  const part = value =>
    Math.round(Math.min(Math.max(value, 0), 255))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

async function dominantColorOf(sharp, buffer) {
  const stats = await sharp(buffer).stats()
  const dominant = stats.dominant
  if (dominant && typeof dominant === 'object') {
    return rgbToHex({ r: dominant.r ?? 0, g: dominant.g ?? 0, b: dominant.b ?? 0 })
  }
  const channels = stats.channels ?? []
  return rgbToHex({
    r: channels[0]?.mean ?? 128,
    g: channels[1]?.mean ?? 128,
    b: channels[2]?.mean ?? 128,
  })
}

async function generate(plans, config, options) {
  const sharp = await loadSharp()
  const configHash = sha256(canonicalConfigJson(config))
  const sourceRoot = resolve(REBUILD_ROOT, config.sourceDir)
  const outputRoot = resolve(REBUILD_ROOT, config.outputDir)
  const manifestPath = resolve(REBUILD_ROOT, config.manifestPath)

  let existing = null
  if (existsSync(manifestPath)) {
    existing = parseMediaManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  }
  const images = existing ? { ...existing.images } : {}
  const quality = config.quality
  const summary = { generated: 0, skipped: 0, images: 0, bytes: 0, errors: [] }

  for (const item of plans) {
    const { plan, buffer } = item
    const sourceSha = sha256(buffer)
    const previous = images[plan.source]
    const expectedFiles = expectedDerivativeFiles({
      schemaVersion: 1,
      config: {
        widths: [...config.widths],
        formats: [...config.formats],
        quality,
        generator: config.generator,
      },
      images: previous ? { [plan.source]: previous } : {},
    })

    if (!options.force && isFresh(previous, sourceSha, configHash, expectedFiles, REBUILD_ROOT)) {
      summary.skipped += plan.derivatives.length
      summary.images++
      continue
    }

    const derivativeMap = {}
    const dominantColor = await dominantColorOf(sharp, buffer)
    for (const target of plan.derivatives) {
      const outputPath = join(outputRoot, target.fileName)
      mkdirSync(dirname(outputPath), { recursive: true })

      let pipeline = sharp(buffer).rotate().resize({
        width: target.width,
        withoutEnlargement: true,
      })
      if (target.format === 'avif') {
        pipeline = pipeline.avif({ quality: quality.avif, effort: 4 })
      } else if (target.format === 'webp') {
        pipeline = pipeline.webp({ quality: quality.webp, effort: 4 })
      } else {
        pipeline = pipeline.jpeg({ quality: quality.jpg, mozjpeg: true, progressive: true })
      }

      try {
        const encoded = await pipeline.toBuffer()
        writeFileSync(outputPath, encoded)
        const widthKey = String(target.width)
        derivativeMap[widthKey] = derivativeMap[widthKey] ?? {}
        derivativeMap[widthKey][target.format] = {
          path: target.publicPath,
          bytes: encoded.length,
          sha256: sha256(encoded),
        }
        summary.generated++
        summary.bytes += encoded.length
      } catch (error) {
        summary.errors.push(`${target.publicPath}: ${error.message}`)
      }
    }

    images[plan.source] = createManifestEntry({
      source: plan.source,
      width: plan.width,
      height: plan.height,
      dominantColor,
      sourceSha256: sourceSha,
      configHash,
      derivatives: derivativeMap,
    })
    summary.images++

    // Keep memory bounded on large batches.
    item.buffer = null
  }

  const manifest = {
    schemaVersion: 1,
    config: {
      widths: [...config.widths],
      formats: [...config.formats],
      quality,
      generator: config.generator,
    },
    images,
  }

  if (options.prune) {
    const referenced = new Set()
    for (const entry of Object.values(images)) {
      for (const formats of Object.values(entry.derivatives)) {
        for (const derivative of Object.values(formats)) referenced.add(derivative.path)
      }
    }
    for (const file of walkOutput(outputRoot)) {
      const publicPath = `/${relative(REBUILD_ROOT, file).split('\\').join('/')}`
      if (!referenced.has(publicPath)) unlinkSync(file)
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, serializeMediaManifest(manifest))
  return { sharp, summary, configHash, manifestPath, sourceRoot }
}

function walkOutput(dir) {
  const files = []
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkOutput(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function check(config) {
  const manifestPath = resolve(REBUILD_ROOT, config.manifestPath)
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      reason: `manifest not found: ${manifestPath}. Run --generate first.`,
      missing: [],
      stale: [],
      total: 0,
    }
  }

  const manifest = parseMediaManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  if (Object.keys(manifest.images).length === 0) {
    return {
      ok: true,
      empty: true,
      reason:
        'manifest contains no generated images yet (pre-generation state); run --plan then --generate with an approved scope',
      missing: [],
      stale: [],
      total: 0,
    }
  }
  const configHash = sha256(canonicalConfigJson(config))
  const missing = []
  const stale = []
  let total = 0

  for (const [source, entry] of Object.entries(manifest.images)) {
    if (entry.configHash !== configHash) stale.push(`${source} (encoding config changed)`)
    const sourcePath = join(
      resolve(REBUILD_ROOT, config.sourceDir),
      source.slice('/images/'.length)
    )
    if (!existsSync(sourcePath)) {
      stale.push(`${source} (source file missing)`)
    } else if (sha256(readFileSync(sourcePath)) !== entry.sourceSha256) {
      stale.push(`${source} (source changed)`)
    }
  }

  for (const file of expectedDerivativeFiles(manifest)) {
    total++
    const absolute = join(REBUILD_ROOT, file.filePath)
    if (!existsSync(absolute)) {
      missing.push(file.publicPath)
      continue
    }
    const bytes = readFileSync(absolute)
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
      stale.push(file.publicPath)
    }
  }

  return { ok: missing.length === 0 && stale.length === 0, missing, stale, total }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return 0
  }

  const config = loadConfig(options)
  const sourceRoot = resolve(REBUILD_ROOT, config.sourceDir)
  if (!existsSync(sourceRoot)) throw new Error(`source dir not found: ${sourceRoot}`)

  let sources = walkRasters(sourceRoot)
  if (options.fromContract) {
    const contractPaths = loadContractPaths(options.fromContract)
    sources = sources.filter(source => contractPaths.has(source))
  }
  if (options.only.length > 0) {
    sources = sources.filter(source => options.only.some(value => source.includes(value)))
  }
  if (Array.isArray(config.include) && config.include.length > 0 && options.only.length === 0) {
    sources = sources.filter(source => config.include.some(value => source.includes(value)))
  }
  if (Array.isArray(config.exclude) && config.exclude.length > 0) {
    sources = sources.filter(source => !config.exclude.some(value => source.includes(value)))
  }
  if (options.limit) sources = sources.slice(0, options.limit)

  if (options.action === 'check') {
    const result = check(config)
    if (options.json) {
      console.log(
        JSON.stringify({ action: 'check', config: config.publicPath, ...result }, null, 2)
      )
    } else {
      console.log(`media --check: ${result.total} derivative files in manifest`)
      if (result.reason) console.log(`  ${result.reason}`)
      if (result.missing.length > 0) {
        console.log(`  missing (${result.missing.length}):`)
        for (const item of result.missing.slice(0, 20)) console.log(`    - ${item}`)
      }
      if (result.stale.length > 0) {
        console.log(`  stale (${result.stale.length}):`)
        for (const item of result.stale.slice(0, 20)) console.log(`    - ${item}`)
      }
      console.log(result.ok ? 'verdict: OK' : 'verdict: FAIL')
    }
    return result.ok ? 0 : 1
  }

  const plans = planAll(sources, config)
  const summary = summarizePlan(plans, config)

  if (options.action === 'plan') {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            action: 'plan',
            config: {
              sourceDir: config.sourceDir,
              outputDir: config.outputDir,
              manifestPath: config.manifestPath,
              widths: config.widths,
              formats: config.formats,
              quality: config.quality,
              include: config.include,
              exclude: config.exclude,
            },
            ...summary,
            plannedPerSource: plans.map(item => ({
              source: item.plan.source,
              width: item.plan.width,
              height: item.plan.height,
              widths: item.plan.widths,
              files: item.plan.derivatives.length,
            })),
          },
          null,
          2
        )
      )
      return 0
    }

    console.log('media --plan (no sharp required)')
    console.log(
      `  source dir: ${config.sourceDir} (${summary.sources} raster sources, ${summary.sourceMiB} MiB)`
    )
    console.log(`  output dir: ${config.outputDir}`)
    console.log(`  manifest:   ${config.manifestPath}`)
    console.log(`  widths:     ${summary.widths.join(', ')} (frozen breakpoint tiers)`)
    console.log(
      `  formats:    ${summary.formats.join(', ')} (q ${Object.values(config.quality).join('/')})`
    )
    console.log(`  planned:    ${summary.plannedFiles} derivative files`)
    console.log(
      `  by format:  ${Object.entries(summary.byFormat)
        .map(([format, count]) => `${format}=${count}`)
        .join(' ')}`
    )
    console.log('  by source group:')
    for (const [group, count] of Object.entries(summary.byRange).sort()) {
      console.log(`    ${group}: ${count}`)
    }
    console.log('')
    console.log('Generation requires the Lead-approved pinned devDependency sharp@0.35.5 and an')
    console.log(
      'explicit scope: --all, --only <substr>, --from-contract <file>, or config.include.'
    )
    console.log(
      'Generated files are self-contained under the output dir and referenced by the manifest.'
    )
    return 0
  }

  if (options.action === 'generate') {
    ensureApproval(options, config)
    const result = await generate(plans, config, options)
    if (options.json) {
      console.log(
        JSON.stringify({
          action: 'generate',
          manifest: result.manifestPath,
          configHash: result.configHash,
          ...result.summary,
        })
      )
    } else {
      console.log(`media --generate: ${result.summary.images} source images`)
      console.log(
        `  encoded: ${result.summary.generated} files (${(result.summary.bytes / 1024).toFixed(0)} KiB)`
      )
      console.log(`  skipped fresh: ${result.summary.skipped} files`)
      console.log(`  manifest: ${result.manifestPath}`)
      if (result.summary.errors.length > 0) {
        console.log(`  errors (${result.summary.errors.length}):`)
        for (const error of result.summary.errors.slice(0, 20)) console.log(`    - ${error}`)
      }
    }
    return result.summary.errors.length > 0 ? 1 : 0
  }

  throw new Error(`unknown action ${options.action}`)
}

try {
  const exitCode = await main()
  process.exitCode = exitCode
} catch (error) {
  console.error(`[media] ${error.message}`)
  process.exitCode = 2
}

export { check, planAll, summarizePlan }
