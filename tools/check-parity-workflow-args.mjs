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
 *   node tools/check-parity-workflow-args.mjs --workflows-dir <dir>
 *
 * `--workflows-dir` points the scan at another directory of workflow files.
 * The contracts are still read from this repo, so the guard keeps resolving
 * selectors against the same contract files the harness will use.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  loadRoutesContract,
  loadUiContract,
  parseCompareArgs,
  resolveSelection,
} from './parity/config.mjs'
import { repoPath } from './lib/paths.mjs'

/**
 * `matrix.mjs` is imported LAZILY, inside the branch that needs it.
 *
 * A static import here drags in `matrix.mjs -> compare.mjs -> diff.mjs`, and
 * `diff.mjs` reaches the native image library. This guard is a pure text check
 * over workflow files, so it must not be able to die because a native image
 * library is absent — reproduced as
 * `ERR_MODULE_NOT_FOUND: Cannot find package 'sharp'` with exit 1 before any
 * invocation was read. That fails closed, but it reports nothing about the
 * workflow arguments it exists to check.
 */
let matrixParseArgs = null
async function loadMatrixParser() {
  if (matrixParseArgs === null) {
    matrixParseArgs = (await import('./parity/matrix.mjs')).parseArgs
  }
  return matrixParseArgs
}

const argv = process.argv.slice(2)
const args = new Set(argv)
const JSON_OUTPUT = args.has('--json')
const WORKFLOWS_DIR_FLAG = argv.indexOf('--workflows-dir')
const workflowsDir =
  WORKFLOWS_DIR_FLAG === -1
    ? repoPath('.github/workflows')
    : path.resolve(argv[WORKFLOWS_DIR_FLAG + 1] ?? repoPath('.github/workflows'))

/**
 * Every `node tools/parity/compare.mjs …` / `node tools/parity/matrix.mjs …`
 * invocation in a workflow file.
 *
 * Both harnesses are matched: `matrix.mjs` is the harness the signed-off
 * cutover baseline was recorded with, so a workflow may legitimately invoke
 * either. Matching only `compare.mjs` would let a broken `matrix.mjs`
 * invocation sit in the file until the next nightly run reported it — the
 * exact failure mode this guard exists to prevent.
 */
function findInvocations(workflowText) {
  const invocations = []
  const pattern = /node\s+tools\/parity\/(compare|matrix)\.mjs((?:[^\n]*\\\r?\n)*[^\n]*)/g
  let match
  while ((match = pattern.exec(workflowText)) !== null) {
    const harness = match[1]
    const raw = match[2]
    // A trailing backslash continues the command onto the next line.
    const tokens = raw
      .replace(/\\\r?\n/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    invocations.push({ harness, snippet: raw.replace(/\r?\n/g, ' ').trim(), tokens })
  }
  return invocations
}

/** Resolve one invocation the way its harness resolves it, and report the first failure. */
async function checkInvocation(invocation, ui, routesContract) {
  try {
    const parsed =
      invocation.harness === 'matrix'
        ? (await loadMatrixParser())(invocation.tokens)
        : parseCompareArgs(invocation.tokens)
    resolveSelection({ ui, routesContract, options: parsed.options })
    return null
  } catch (error) {
    return error.message
  }
}

const workflowDir = workflowsDir
const files = readdirSync(workflowDir)
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort()

const ui = await loadUiContract()
const routesContract = await loadRoutesContract()

const results = []
for (const file of files) {
  const text = readFileSync(path.join(workflowDir, file), 'utf8')
  for (const invocation of findInvocations(text)) {
    results.push({
      file: `.github/workflows/${file}`,
      harness: invocation.harness,
      snippet: invocation.snippet,
      error: await checkInvocation(invocation, ui, routesContract),
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
    console.error(
      `      invoked as: node tools/parity/${violation.harness}.mjs${violation.snippet}`
    )
  }
} else {
  console.log(
    `  + parity workflow invocations valid (${results.length} invocation(s) across ${files.length} workflow file(s))`
  )
}

process.exit(violations.length === 0 ? 0 : 1)
