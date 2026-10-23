#!/usr/bin/env node
/**
 * Validate and post the structured Claude review for a pull request.
 *
 * The workflow this replaces had a silent-success hole:
 *
 *   if: github.event.pull_request.number != '' && steps.review.outputs.structured_output != ''
 *
 * When the action produced no structured output the step was SKIPPED, so the
 * `exit 1` guard inside it — the thing meant to fail the job — never ran. An
 * empty, missing or malformed review therefore looked like a clean advisory
 * pass. This script owns that decision instead, and every invalid shape fails
 * the job with a stable `BLOCKED ... <label>` annotation and no comment.
 *
 * Checks, in order (all before any network write):
 *   1. GH_TOKEN present                  -> missing-token
 *   2. repository / PR number / head SHA -> invalid-repository, invalid-pr-number, invalid-head-sha
 *   3. the review action succeeded       -> action-failed | action-cancelled | action-skipped
 *   4. structured output present         -> empty-output
 *   5. structured output is a JSON object-> malformed-output
 *   6. non-empty review_markdown string  -> missing-field
 * Then: the PR still points at the reviewed head (stale-head), the comment is
 * created (post-failed) and read back byte-for-byte (readback-mismatch).
 *
 * The token is only used in request headers; review text is untrusted data and
 * is never executed, only posted.
 */
const MAX_MARKDOWN_LENGTH = 20_000
const REVIEW_LABEL = 'BLOCKED claude review output'

const env = name => process.env[name] ?? ''

function fail(label, detail) {
  const suffix = detail ? `: ${detail}` : ''
  console.error(`::error title=${REVIEW_LABEL}::${label}${suffix}`)
  process.exit(1)
}

const token = env('GH_TOKEN')
if (!token) {
  fail(
    'missing-token',
    'GH_TOKEN is not set, so no review can be posted. The workflow passes secrets.GITHUB_TOKEN.'
  )
}

const repository = env('GITHUB_REPOSITORY')
if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
  fail('invalid-repository', 'GITHUB_REPOSITORY must be owner/name')
}

const prNumberRaw = env('PR_NUMBER').trim()
if (!/^[1-9][0-9]*$/.test(prNumberRaw)) {
  fail(
    'invalid-pr-number',
    `no validated pull request number was resolved (received "${prNumberRaw.slice(0, 40)}")`
  )
}
const prNumber = Number(prNumberRaw)

const headSha = env('PR_HEAD_SHA').trim()
if (!/^[0-9a-f]{40}$/.test(headSha)) {
  fail('invalid-head-sha', 'no validated head SHA was resolved for the pull request')
}

const rawOutcome = env('REVIEW_OUTCOME').trim()
const outcome = /^[a-z]+$/.test(rawOutcome) ? rawOutcome : 'unknown'
if (outcome !== 'success') {
  fail(
    `action-${outcome}`,
    'the Claude review step did not succeed, so no review was produced and nothing was posted'
  )
}

const structuredRaw = env('STRUCTURED_OUTPUT')
if (structuredRaw.trim() === '') {
  fail(
    'empty-output',
    'the Claude review step returned no structured output, so there is no review to post'
  )
}

let structured
try {
  structured = JSON.parse(structuredRaw)
} catch {
  fail('malformed-output', 'the structured output is not valid JSON')
}

if (structured === null || typeof structured !== 'object' || Array.isArray(structured)) {
  fail('malformed-output', 'the structured output is not a JSON object')
}

const markdown = structured.review_markdown
if (typeof markdown !== 'string' || markdown.trim() === '') {
  fail('missing-field', 'the structured output has no non-empty review_markdown string')
}
if (markdown.length > MAX_MARKDOWN_LENGTH) {
  fail(
    'review-too-large',
    `review_markdown is ${markdown.length} characters; the cap is ${MAX_MARKDOWN_LENGTH}`
  )
}

const apiBase = (env('GITHUB_API_URL') || 'https://api.github.com').replace(/\/+$/, '')
const runNumber = env('GITHUB_RUN_NUMBER').trim()

async function request(apiPath, init = {}) {
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'wedding-claude-review-post',
    ...(init.headers ?? {}),
  }
  try {
    return await fetch(`${apiBase}${apiPath}`, { ...init, headers })
  } catch {
    fail('api-unreachable', `${apiBase} could not be reached`)
    return null
  }
}

// Never post a review for a head the PR has already moved past.
const prResponse = await request(`/repos/${repository}/pulls/${prNumber}`)
if (!prResponse.ok) {
  fail('pr-unavailable', `GitHub returned ${prResponse.status} for the pull request lookup`)
}
let pullRequest
try {
  pullRequest = await prResponse.json()
} catch {
  fail('pr-unreadable', 'the pull request metadata was not valid JSON')
}
if (pullRequest?.head?.sha !== headSha) {
  fail(
    'stale-head',
    `the pull request is now at ${String(pullRequest?.head?.sha ?? 'unknown').slice(0, 12)} but the review covers ${headSha.slice(0, 12)}; not posting a superseded review`
  )
}

const footer = runNumber
  ? `<sub>Claude review (automated) · head ${headSha} · run ${runNumber}</sub>`
  : `<sub>Claude review (automated) · head ${headSha}</sub>`

const body = ['## Claude review (automated)', '', markdown.trim(), '', footer].join('\n')

const postResponse = await request(`/repos/${repository}/issues/${prNumber}/comments`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ body }),
})
if (!postResponse.ok) {
  fail('post-failed', `GitHub returned ${postResponse.status} when creating the review comment`)
}
let created
try {
  created = await postResponse.json()
} catch {
  fail('post-failed', 'the comment response was not valid JSON')
}
if (!Number.isInteger(created?.id)) {
  fail('post-failed', 'the comment response carried no comment id')
}

const readbackResponse = await request(`/repos/${repository}/issues/comments/${created.id}`)
if (!readbackResponse.ok) {
  fail('readback-failed', `GitHub returned ${readbackResponse.status} reading the comment back`)
}
let readback
try {
  readback = await readbackResponse.json()
} catch {
  fail('readback-failed', 'the comment readback was not valid JSON')
}

const normalise = value =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
if (normalise(readback?.body) !== normalise(body)) {
  fail(
    'readback-mismatch',
    `comment ${created.id} does not contain the review that was posted; treat the posted review as unverified`
  )
}
const commentUrl = String(readback?.html_url ?? created?.html_url ?? '')
if (commentUrl && !new RegExp(`/pull/${prNumber}(?:[#/?]|$)`).test(commentUrl)) {
  fail('readback-mismatch', `comment ${created.id} is not attached to pull request #${prNumber}`)
}

console.log(
  `Posted Claude review comment ${created.id} for PR #${prNumber} head ${headSha.slice(0, 12)} and read it back: ${readback?.html_url ?? created?.html_url ?? 'no url'}`
)
