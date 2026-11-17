#!/usr/bin/env node
/**
 * Fails when a workflow invokes the parity harness with something the harness
 * will reject at run time.
 *
 * Why this exists: the nightly Rebuild Workbench parity job failed every
 * night since 2026-11-12 with exit code 2 and
 * `[parity] ERROR unknown argument "--all"`. The workflow passed `--all` to
 * `tools/parity/compare.mjs`, whose parser has no such flag. Nothing failed
 * loudly at PR time: the job only runs on a schedule, on manual dispatch, or
 * with the `run-parity` label, so the broken invocation sat in the file until
 * the nightly run reported it.
 *
 * This guard resolves each parity invocation the workflow will run, using the
 * harness's OWN parser and contract loaders — never a second copy of the flag
 * list. Two classes are caught:
 *
 *   1. Unknown flags. `parseCompareArgs` throws on any flag it does not know.
 *   2. Unknown selectors. `--routes`, `--matrix` and `--themes` take values
 *      that are only resolved against `contracts/routes.json` and
 *      `contracts/ui.json` at run time, so a typo like `--routes priortiy`
 *      would otherwise survive until the nightly job ran it.
 *
 * Both are resolved here against the same contracts the harness reads, so an
 * invocation that cannot work fails the PR that introduces it instead of the
 * next nightly run.
 *
 * Usage:
 *   node tools/check-parity-workflow-args.mjs           # exit 1 on violations
 *   node tools/check-parity-workflow-args.mjs --json
 */
import { readFileSync, readdirSync } from 'node:fs'
import {
  loadRoutesContract,
  loadUiContract,
  parseCompareArgs,
  resolveSelection,
} from './parity/config.mjs'
import { repoPath } from './lib/paths.mjs'

const args = new Set(process.argv.slice(2))
const JSON_OUTPUT = args.has('--json')

/** Every `node tools/parity/compare.mjs …` invocation in a workflow file. */
function findInvocations(workflowText) {
  const invocations = []
  const pattern = /node\s+tools\/parity\/compare\.mjs((?:[^\n]*\\\r?\n)*[^\n]*)/g
  let match
  while ((match = pattern.exec(workflowText)) !== null) {
    const raw = match[1]
    // A trailing backslash continues the command onto the next line.
    const tokens = raw
      .replace(/\\\r?\n/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    invocations.push({ snippet: raw.replace(/\r?\n/g, ' ').trim(), tokens })
  }
  return invocations
}

/** Resolve one invocation the way the harness resolves it, and report the first failure. */
function checkInvocation(invocation, ui, routesContract) {
  try {
    const parsed = parseCompareArgs(invocation.tokens)
    resolveSelection({ ui, routesContract, options: parsed.options })
    return null
  } catch (error) {
    return error.message
  }
}

const workflowDir = repoPath('.github/workflows')
const files = readdirSync(workflowDir)
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort()

const ui = await loadUiContract()
const routesContract = await loadRoutesContract()

const results = []
for (const file of files) {
  const text = readFileSync(repoPath('.github/workflows', file), 'utf8')
  for (const invocation of findInvocations(text)) {
    results.push({
      file: `.github/workflows/${file}`,
      snippet: invocation.snippet,
      error: checkInvocation(invocation, ui, routesContract),
    })
  }
}

const violations = results.filter(result => result.error !== null)

if (JSON_OUTPUT) {
  process.stdout.write(
    `${JSON.stringify(
      { ok: violations.length === 0, checked: results.length, violations, invocations: results },
      null,
      2
    )}\n`
  )
} else if (violations.length) {
  console.error(`  x ${violations.length} parity invocation(s) the harness will reject:`)
  for (const violation of violations) {
    console.error(`      ${violation.file}: ${violation.error}`)
    console.error(`      invoked as: node tools/parity/compare.mjs${violation.snippet}`)
  }
} else {
  console.log(
    `  + parity workflow invocations valid (${results.length} invocation(s) across ${files.length} workflow file(s))`
  )
}

process.exit(violations.length === 0 ? 0 : 1)
