#!/usr/bin/env node
/**
 * Fails when a workflow invokes the parity harness with a flag the harness
 * does not accept.
 *
 * Why this exists: the nightly Rebuild Workbench parity job has failed every
 * night since 2026-11-12 with exit code 2 and
 * `[parity] ERROR unknown argument "--all"`. The workflow passed `--all` to
 * `tools/parity/compare.mjs`, whose parser has no such flag. Nothing failed
 * loudly at PR time: the job only runs on a schedule, so the broken invocation
 * sat in the file until the nightly run reported it. This guard parses the
 * same invocation the workflow will run and hands the flags to the harness's
 * own parser, so an unknown flag fails the PR that introduces it instead of
 * the next nightly run.
 *
 * The parser is the authority: this script does not maintain a second list of
 * accepted flags, so a flag added to the harness is accepted here with no
 * change.
 *
 * Usage:
 *   node tools/check-parity-workflow-args.mjs           # exit 1 on violations
 *   node tools/check-parity-workflow-args.mjs --json
 */
import { readFileSync, readdirSync } from 'node:fs'
import { parseCompareArgs } from './parity/config.mjs'
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

function checkFile(file) {
  const absolute = repoPath('.github/workflows', file)
  const text = readFileSync(absolute, 'utf8')
  return findInvocations(text).map(invocation => {
    let error = null
    try {
      parseCompareArgs(invocation.tokens)
    } catch (parseError) {
      error = parseError.message
    }
    return { file: `.github/workflows/${file}`, snippet: invocation.snippet, error }
  })
}

const workflowDir = repoPath('.github/workflows')
const files = readdirSync(workflowDir)
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort()
const results = files.flatMap(checkFile)
const violations = results.filter(result => result.error !== null)

if (JSON_OUTPUT) {
  process.stdout.write(
    `${JSON.stringify({ ok: violations.length === 0, checked: results.length, violations, invocations: results }, null, 2)}\n`
  )
} else if (violations.length) {
  console.error(`  x ${violations.length} parity invocation(s) use a flag the harness rejects:`)
  for (const violation of violations) {
    console.error(`      ${violation.file}: ${violation.error}`)
    console.error(`      invoked as: node tools/parity/compare.mjs${violation.snippet}`)
  }
} else {
  console.log(
    `  + parity workflow args valid (${results.length} invocation(s) across ${files.length} workflow file(s))`
  )
}

process.exit(violations.length === 0 ? 0 : 1)
