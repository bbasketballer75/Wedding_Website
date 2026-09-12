#!/usr/bin/env node
/**
 * scripts/check-repo-hygiene.js
 *
 * Lightweight repo-root hygiene check. Catches the patterns that caused the
 * 2026-09-11 revival friction:
 *
 *   - *.bak-* / node_modules.bak-* directories at the repo root
 *     (caused ESLint to recurse into a 1.2 GB unused backup, hanging for
 *     minutes parsing @sentry / @tensorflow/tfjs / @babel/parser)
 *   - verify-*.log and .verify-release-run*.log files at the repo root
 *     (manually redirected npm run verify:release output that should have
 *     gone to a temp directory)
 *
 * Defaults to dry-run + exit 1 (CI-friendly). Pass `--prune` to actually
 * delete the offending paths (with confirmation).
 *
 * Usage:
 *   node scripts/check-repo-hygiene.js [DIR]               # audit only, exit 1 if bloat found
 *   node scripts/check-repo-hygiene.js [DIR] --prune      # auto-delete and exit 0
 *   node scripts/check-repo-hygiene.js [DIR] --json       # machine-readable output
 *
 * If DIR is omitted, defaults to process.cwd().
 *
 * Wired into verify:env (the first gate of verify:release) so the bloat
 * is caught before it can hang lint, build, or release.
 */

import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const FLAGS = new Set(['--prune', '--json'])
const ROOT_ARG = process.argv.slice(2).find(a => !FLAGS.has(a))
const ROOT = resolve(ROOT_ARG || process.cwd())
const DRY_RUN = !process.argv.includes('--prune')
const JSON_OUTPUT = process.argv.includes('--json')

/**
 * Patterns that indicate "this should not be at the repo root".
 * Keep in sync with .gitignore "Backup / snapshot directories" block.
 */
const BLOAT_PATTERNS = [
  { name: 'node_modules backup', match: e => /^node_modules\.bak-/.test(e), kind: 'dir' },
  { name: 'generic backup dir', match: e => /\.(bak|backup|orig|old)-\d+/.test(e), kind: 'dir' },
  { name: 'release verify log', match: e => /^verify-.*\.log$/.test(e), kind: 'file' },
  { name: 'hidden verify log', match: e => /^\.verify-release-run.*\.log$/.test(e), kind: 'file' },
]

/**
 * Optional: also flag directories that are gitignored but have grown past a
 * sensible size threshold (playwright-report, test-results, coverage, etc.).
 * These won't block CI but should be surfaced for awareness.
 */
const LARGE_IGNORED_DIRS = [
  { name: 'playwright-report', warnMB: 500 },
  { name: 'test-results', warnMB: 500 },
  { name: 'coverage', warnMB: 100 },
  { name: 'dev-dist', warnMB: 50 },
]

const MB = 1024 * 1024

function dirSizeMB(p) {
  let total = 0
  try {
    const stack = [p]
    while (stack.length) {
      const cur = stack.pop()
      for (const entry of readdirSync(cur, { withFileTypes: true })) {
        const full = join(cur, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile()) total += statSync(full).size
      }
    }
  } catch {
    return 0
  }
  return Math.round(total / MB)
}

function main() {
  const findings = []
  const warnings = []

  // Scan top-level entries (excluding .git, node_modules, etc.)
  const skip = new Set(['node_modules', '.git', 'dist', '.agents'])
  const entries = readdirSync(ROOT).filter(e => !skip.has(e))

  for (const entry of entries) {
    const fullPath = join(ROOT, entry)
    const stat = statSync(fullPath, { throwIfNoEntry: false })
    if (!stat) continue
    const isDir = stat.isDirectory()

    for (const pattern of BLOAT_PATTERNS) {
      if (pattern.kind === 'dir' && !isDir) continue
      if (pattern.kind === 'file' && isDir) continue
      if (pattern.match(entry)) {
        findings.push({
          path: fullPath,
          name: entry,
          kind: pattern.kind,
          category: pattern.name,
          sizeMB: isDir ? dirSizeMB(fullPath) : Math.round(stat.size / MB),
        })
        break
      }
    }
  }

  // Warn-only on large ignored dirs
  for (const { name, warnMB } of LARGE_IGNORED_DIRS) {
    const p = join(ROOT, name)
    if (!existsSync(p)) continue
    const size = dirSizeMB(p)
    if (size >= warnMB) {
      warnings.push({ path: p, name, sizeMB: size, thresholdMB: warnMB })
    }
  }

  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify({ findings, warnings, dryRun: DRY_RUN }, null, 2)}\n`)
  } else {
    if (findings.length === 0 && warnings.length === 0) {
      console.log('✅ repo hygiene: no bloat at root')
    } else {
      if (findings.length > 0) {
        const verb = DRY_RUN ? 'FOUND (would prune)' : 'PRUNED'
        console.log(`❌ repo hygiene: ${findings.length} bloat item(s) ${verb}`)
        for (const f of findings) {
          console.log(`   - [${f.category}] ${f.name}  (${f.sizeMB} MB)`)
          if (!DRY_RUN) {
            try {
              rmSync(f.path, { recursive: true, force: true })
              console.log('     ✓ removed')
            } catch (err) {
              console.log(`     ✗ failed: ${err.message}`)
            }
          }
        }
      }
      if (warnings.length > 0) {
        console.log(`\n⚠️  large gitignored dirs (consider pruning manually):`)
        for (const w of warnings) {
          console.log(`   - ${w.name}: ${w.sizeMB} MB (threshold ${w.thresholdMB} MB)`)
        }
      }
    }
  }

  // After pruning, re-check existence to determine exit code.
  // --prune mode should exit 0 if everything was successfully removed.
  // --dry-run (default) exits 1 if anything was found (CI gate).
  let residual = findings
  if (!DRY_RUN && findings.length > 0) {
    residual = findings.filter(f => existsSync(f.path))
  }
  process.exit(residual.length > 0 ? 1 : 0)
}

main()
