/**
 * Small shared helpers for the perf harness (plain Node ESM, no dependencies).
 *
 * The harness is measurement-only: it never builds, deploys, or writes outside
 * `tools/perf/output/`. It is deliberately dependency-light because it must be
 * runnable from CI without a second install step.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const KiB = 1024

export const here = path.dirname(fileURLToPath(import.meta.url))
/** Repo root: tools/perf/lib -> tools/perf -> tools -> repo root. */
export const repoRoot = path.resolve(here, '..', '..', '..')
export const rebuildRoot = path.join(repoRoot, 'rebuild')
export const defaultOutDir = path.join(repoRoot, 'tools', 'perf', 'output')

export const toPosix = value => value.split(path.sep).join('/')

export function formatKiB(bytes) {
  return `${(bytes / KiB).toFixed(2)} KiB`
}

export function formatMs(milliseconds) {
  if (milliseconds === null || milliseconds === undefined || Number.isNaN(milliseconds))
    return 'n/a'
  return `${Math.round(milliseconds)} ms`
}

export function median(values) {
  const finite = values.filter(value => typeof value === 'number' && Number.isFinite(value))
  if (finite.length === 0) return null
  const sorted = [...finite].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

/** Markdown table with right-aligned numeric columns. */
export function markdownTable(headers, rows, align = []) {
  const line = row => `| ${row.map(cell => String(cell)).join(' | ')} |`
  const separator = headers.map((_, index) => {
    const alignment = align[index]
    if (alignment === 'right') return '---:'
    if (alignment === 'center') return ':---:'
    return '---'
  })
  return [line(headers), `| ${separator.join(' | ')} |`, ...rows.map(line)].join('\n')
}

export const log = {
  step: message => console.log(`\n> ${message}`),
  ok: message => console.log(`  + ${message}`),
  info: message => console.log(`  - ${message}`),
  warn: message => console.warn(`  ! ${message}`),
  fail: message => console.error(`  x ${message}`),
}

/** Error type the CLIs map to exit code 2 (harness/config error, not a budget failure). */
export class HarnessError extends Error {
  constructor(message) {
    super(message)
    this.name = 'HarnessError'
  }
}

export function isMainModule(importMetaUrl) {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === fileURLToPath(importMetaUrl)
  } catch {
    return false
  }
}
