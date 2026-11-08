#!/usr/bin/env node
/**
 * Coverage baseline for the frozen legacy app.
 *
 * Runs exactly the command the baseline documents:
 *
 *   npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary
 *
 * No config files are edited. Vitest writes `coverage/` (gitignored); this
 * module parses `coverage/coverage-summary.json` and writes a small, deterministic
 * summary to `contracts/baseline/coverage.json` for metrics.json/BASELINE.md.
 *
 * Usage:
 *   node tools/baseline/coverage.mjs
 *   node tools/baseline/coverage.mjs --out <path>
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJson } from '../lib/fs.mjs'
import { baselineDir, repoPath, repoRoot } from '../lib/paths.mjs'

export const COVERAGE_ARGS = [
  'vitest',
  'run',
  '--coverage',
  '--coverage.reporter=json-summary',
  '--coverage.reporter=text-summary',
]

export const COVERAGE_COMMAND = `npx ${COVERAGE_ARGS.join(' ')}`

const DEFAULT_TIMEOUT_MS = 600_000

function spawnCommand(command, { cwd, timeoutMs }) {
  return new Promise(resolve => {
    const startedAt = Date.now()
    const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('close', exitCode => {
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr, timedOut, wallMs: Date.now() - startedAt })
    })
  })
}

function parseTotals(summary) {
  const total = summary.total || {}
  const readMetric = name => {
    const value = total[name] || {}
    return {
      total: typeof value.total === 'number' ? value.total : null,
      covered: typeof value.covered === 'number' ? value.covered : null,
      skipped: typeof value.skipped === 'number' ? value.skipped : null,
      pct: typeof value.pct === 'number' ? value.pct : null,
    }
  }
  return {
    statements: readMetric('statements'),
    branches: readMetric('branches'),
    functions: readMetric('functions'),
    lines: readMetric('lines'),
  }
}

function parseVitestOutput(stdout, stderr) {
  const text = `${stdout}\n${stderr}`
  const numberAfter = label => {
    const match = text.match(new RegExp(`${label}\\s+([\\d,]+)`))
    return match ? Number(match[1].replace(/,/g, '')) : null
  }
  const durationMatch = text.match(/Duration\s+([\d.]+m?s[^\n]*)/)
  const coverageMatch = text.match(/Statements\s*:\s*([\d.]+)%/)
  return {
    testFiles: numberAfter('Test Files'),
    tests: numberAfter('Tests'),
    failed: numberAfter('failed'),
    durationText: durationMatch ? durationMatch[1].trim() : null,
    statementsPctFromTextSummary: coverageMatch ? Number(coverageMatch[1]) : null,
  }
}

export async function runCoverage({ outPath = path.join(baselineDir, 'coverage.json') } = {}) {
  const result = await spawnCommand(COVERAGE_COMMAND, {
    cwd: repoRoot,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  const parsedOutput = parseVitestOutput(result.stdout, result.stderr)

  const summaryPath = repoPath('coverage', 'coverage-summary.json')
  let coverageSummary = null
  try {
    coverageSummary = JSON.parse(await readFile(summaryPath, 'utf8'))
  } catch {
    coverageSummary = null
  }

  const files = coverageSummary
    ? Object.keys(coverageSummary).filter(key => key !== 'total').length
    : 0

  const record = {
    command: COVERAGE_COMMAND,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    wallMs: result.wallMs,
    passed: result.exitCode === 0,
    coverageSummaryPath: 'coverage/coverage-summary.json',
    totals: coverageSummary ? parseTotals(coverageSummary) : null,
    coveredFiles: files,
    testRun: parsedOutput,
    outputTail: `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-25),
  }

  await writeJson(outPath, record)
  return { record, outPath }
}

async function main() {
  const args = process.argv.slice(2)
  let outPath = path.join(baselineDir, 'coverage.json')
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--out' && args[index + 1]) {
      outPath = path.resolve(args[index + 1])
      index += 1
    }
  }

  process.stdout.write(`> coverage: ${COVERAGE_COMMAND}\n`)
  const { record } = await runCoverage({ outPath })
  process.stdout.write(`  + exit ${record.exitCode} in ${record.wallMs} ms\n`)
  if (record.totals) {
    const { lines, statements, functions, branches } = record.totals
    process.stdout.write(
      `  + lines ${lines.pct}% (${lines.covered}/${lines.total})  ` +
        `statements ${statements.pct}%  functions ${functions.pct}%  branches ${branches.pct}%\n`
    )
  } else {
    process.stdout.write('  ! coverage-summary.json not produced\n')
  }
  if (!record.passed) {
    process.stdout.write(`  ! coverage run failed; tail:\n${record.outputTail.join('\n')}\n`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch(error => {
    console.error(`\n> coverage capture FAILED: ${error.stack || error.message}`)
    process.exit(1)
  })
}
