#!/usr/bin/env node
/**
 * Resolve, validate and stage the pull request a Claude review run targets.
 *
 * Why this exists: the review job used to check out whatever the event
 * provided — for `workflow_dispatch` that is the default branch, so a manual
 * "review" run silently reviewed `main` instead of a PR. It also left Claude
 * with a read-only tree and no way to see the diff. This step resolves the PR
 * from the event (or the required manual input), refuses anything that is not
 * an open PR against `main`, verifies the head SHA, and stages the exact
 * head/base diff plus bounded metadata into a read-only input file. Claude
 * keeps Read/Grep/Glob — no shell or MCP permission is widened to fetch data.
 *
 * Every refusal prints a stable `BLOCKED ... <label>` annotation and exits 1.
 * The token is only ever used in a request header; it is never logged.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MAX_TITLE_LENGTH = 200
const MAX_DIFF_BYTES = 400_000
const BASE_BRANCH = 'main'
const EVENT_NAMES = new Set(['pull_request', 'pull_request_target', 'workflow_dispatch'])

const env = name => process.env[name] ?? ''

function fail(label, detail) {
  const suffix = detail ? `: ${detail}` : ''
  console.error(`::error title=BLOCKED claude review target::${label}${suffix}`)
  process.exit(1)
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
}

const token = env('GH_TOKEN')
const repository = env('GITHUB_REPOSITORY')
const apiBase = (env('GITHUB_API_URL') || 'https://api.github.com').replace(/\/+$/, '')
const eventName = env('GITHUB_EVENT_NAME')

if (!token) {
  fail(
    'missing-token',
    'GH_TOKEN is not set, so the PR target and its diff cannot be read. The workflow passes secrets.GITHUB_TOKEN.'
  )
}
if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
  fail('invalid-repository', 'GITHUB_REPOSITORY must be owner/name')
}
if (!EVENT_NAMES.has(eventName)) {
  fail('unsupported-event', `this workflow cannot review a "${eventName || 'missing'}" event`)
}

function readEventPayload() {
  const eventPath = env('GITHUB_EVENT_PATH')
  if (!eventPath) return null
  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'))
  } catch {
    fail('unreadable-event', 'the workflow event payload could not be read as JSON')
    return null
  }
}

let prNumber = null
let expectedHeadSha = null

if (eventName === 'workflow_dispatch') {
  const rawInput = env('INPUT_PR').trim()
  if (!/^[1-9][0-9]*$/.test(rawInput)) {
    fail(
      'invalid-pr-input',
      `workflow_dispatch requires inputs.pr to be a pull request number, received "${rawInput.slice(0, 40)}"`
    )
  }
  prNumber = Number(rawInput)
} else {
  const payload = readEventPayload()
  const pullRequest = payload?.pull_request
  if (!pullRequest || !Number.isInteger(pullRequest.number)) {
    fail('event-missing-pr', 'the pull_request event carried no pull request number')
  }
  if (!isSha(pullRequest.head?.sha)) {
    fail('event-missing-head', 'the pull_request event carried no head SHA')
  }
  prNumber = pullRequest.number
  expectedHeadSha = pullRequest.head.sha
}

async function request(apiPath, accept) {
  const headers = {
    accept,
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'wedding-claude-review-target',
  }
  try {
    return await fetch(`${apiBase}${apiPath}`, { headers })
  } catch {
    fail('api-unreachable', `${apiBase} could not be reached`)
    return null
  }
}

const prResponse = await request(
  `/repos/${repository}/pulls/${prNumber}`,
  'application/vnd.github+json'
)
if (prResponse.status === 401 || prResponse.status === 403) {
  fail('unauthorized', `GitHub returned ${prResponse.status} for the pull request lookup`)
}
if (prResponse.status === 404) {
  fail('pr-not-found', `pull request #${prNumber} does not exist in ${repository}`)
}
if (!prResponse.ok) {
  fail('pr-unavailable', `GitHub returned ${prResponse.status} for the pull request lookup`)
}

let pullRequest
try {
  pullRequest = await prResponse.json()
} catch {
  fail('pr-unreadable', 'the pull request metadata was not valid JSON')
}

if (typeof pullRequest?.number !== 'number') {
  fail('pr-unreadable', 'the pull request metadata carried no number')
}
if (pullRequest.base?.ref !== BASE_BRANCH) {
  fail(
    'target-not-main',
    `pull request #${pullRequest.number} targets "${pullRequest.base?.ref ?? 'unknown'}", not ${BASE_BRANCH}`
  )
}
if (pullRequest.state !== 'open' || pullRequest.merged === true) {
  fail(
    'pr-not-open',
    `pull request #${pullRequest.number} is ${pullRequest.merged ? 'merged' : pullRequest.state}`
  )
}
if (!isSha(pullRequest.head?.sha)) {
  fail('pr-head-missing', `pull request #${pullRequest.number} carried no head SHA`)
}
if (expectedHeadSha && pullRequest.head.sha !== expectedHeadSha) {
  fail(
    'head-drift',
    `the event expected head ${expectedHeadSha.slice(0, 12)} but the PR is at ${pullRequest.head.sha.slice(0, 12)}`
  )
}

const headSha = pullRequest.head.sha
const diffResponse = await request(
  `/repos/${repository}/pulls/${prNumber}`,
  'application/vnd.github.diff'
)
if (!diffResponse.ok) {
  fail('diff-unavailable', `GitHub returned ${diffResponse.status} for the pull request diff`)
}

let diff
try {
  diff = await diffResponse.text()
} catch {
  fail('diff-unreadable', 'the pull request diff could not be read')
}

const diffBytes = Buffer.byteLength(diff, 'utf8')
if (diff.trim() === '') {
  fail('empty-diff', `pull request #${prNumber} has an empty diff at ${headSha.slice(0, 12)}`)
}
if (diffBytes > MAX_DIFF_BYTES) {
  fail(
    'diff-too-large',
    `the diff is ${diffBytes} bytes; the review input is capped at ${MAX_DIFF_BYTES} bytes`
  )
}

const contextDir = env('REVIEW_CONTEXT_DIR') || path.join(os.tmpdir(), 'claude-review')
const diffPath = path.join(contextDir, 'pr.diff')
const metadataPath = path.join(contextDir, 'pr-metadata.json')

const metadata = {
  number: pullRequest.number,
  title: String(pullRequest.title ?? '').slice(0, MAX_TITLE_LENGTH),
  state: String(pullRequest.state),
  draft: Boolean(pullRequest.draft),
  base_ref: String(pullRequest.base.ref),
  base_sha: String(pullRequest.base.sha ?? ''),
  head_sha: headSha,
  changed_files: Number(pullRequest.changed_files ?? 0),
  additions: Number(pullRequest.additions ?? 0),
  deletions: Number(pullRequest.deletions ?? 0),
  diff_bytes: diffBytes,
  repo: repository,
  source: eventName,
}

mkdirSync(contextDir, { recursive: true })
writeFileSync(diffPath, diff)
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)

const outputs = [
  `pr_number=${pullRequest.number}`,
  `head_sha=${headSha}`,
  `base_sha=${metadata.base_sha}`,
  `checkout_ref=refs/pull/${pullRequest.number}/head`,
  `diff_path=${diffPath}`,
  `metadata_path=${metadataPath}`,
]

const githubOutput = env('GITHUB_OUTPUT')
if (!githubOutput) {
  fail(
    'missing-github-output',
    'GITHUB_OUTPUT is not set, so the resolved target cannot be published'
  )
}
appendFileSync(githubOutput, `${outputs.join('\n')}\n`)

console.log(
  `Resolved PR #${pullRequest.number} (${eventName}) head ${headSha.slice(0, 12)} base ${metadata.base_ref}: ${diffBytes} diff bytes staged at ${diffPath}`
)
