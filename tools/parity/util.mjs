/**
 * Shared helpers for the parity harness.
 *
 * The harness is plain Node ESM with no dependencies beyond the repo's own
 * devDependencies (playwright + sharp). Everything here is stack-neutral: it
 * knows about files, JSON, hashing and text normalisation, never about the
 * legacy app's React source.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PARITY_DIR = fileURLToPath(new URL('.', import.meta.url))
export const ROOT = path.resolve(PARITY_DIR, '..', '..')
export const DEFAULT_OUT_DIR = path.join(PARITY_DIR, 'output')
export const CONTRACTS_DIR = path.join(ROOT, 'contracts')
export const ALLOWLIST_PATH = path.join(CONTRACTS_DIR, 'parity-allowlist.json')

/** Error that maps to CLI exit code 2 (harness/config error, not a parity diff). */
export class HarnessError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'HarnessError'
    this.exitCode = options.exitCode ?? 2
    this.details = options.details ?? null
  }
}

/**
 * Logging. `--json` mode keeps stdout parseable: every human line goes to
 * stderr and the JSON document is the only thing written to stdout.
 */
export const log = (() => {
  let jsonMode = false
  const write = (message, prefix = '') => {
    if (!jsonMode) process.stderr.write(`[parity] ${prefix}${message}\n`)
  }
  return {
    setJsonMode(value) {
      jsonMode = Boolean(value)
    },
    isJsonMode() {
      return jsonMode
    },
    info: message => write(message),
    step: message => write(message, '· '),
    warn: message => write(message, 'WARN '),
    error: message => write(message, 'ERROR '),
    /** Human-facing result line (stdout when not in JSON mode). */
    out: message => {
      if (!jsonMode) process.stdout.write(`${message}\n`)
    },
    /** Machine-facing JSON document (stdout even in JSON mode). */
    printJson: payload => process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`),
  }
})()

export async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function readJsonFile(file) {
  const raw = await fs.readFile(file, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new HarnessError(`Invalid JSON in ${file}: ${error.message}`, { cause: error })
  }
}

export async function writeJsonFile(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeTextFile(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, value.endsWith('\n') ? value : `${value}\n`, 'utf8')
}

export async function readFileBuffer(file) {
  return fs.readFile(file)
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function nowIso() {
  return new Date().toISOString()
}

export function sanitizeKey(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'x'
  )
}

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]
  )
}

export function formatRatio(ratio) {
  return `${(ratio * 100).toFixed(4)}%`
}

/** Collapse whitespace so two DOM captures compare on their visible text. */
export function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Compare URLs on their path (same-origin) so both sides are comparable. */
export function stripOrigin(value, baseUrl) {
  const text = String(value ?? '')
  if (!text) return ''
  try {
    const parsed = new URL(text, baseUrl)
    const base = new URL(baseUrl)
    if (parsed.origin === base.origin) return `${parsed.pathname}${parsed.search}${parsed.hash}`
    return parsed.href
  } catch {
    return text
  }
}

export function parseFiniteNumber(value, name, { min = 0, max = Infinity } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HarnessError(`--${name} must be a number between ${min} and ${max}, got "${value}"`)
  }
  return number
}

export function isHttpUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Split a comma list, trim, drop empties, keep first occurrence order. */
export function splitList(value) {
  if (value === undefined || value === null || value === '') return []
  const seen = new Set()
  const items = []
  for (const raw of String(value).split(',')) {
    const item = raw.trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    items.push(item)
  }
  return items
}

export function summarizeFiles(files) {
  return files.map(file => path.basename(file))
}
