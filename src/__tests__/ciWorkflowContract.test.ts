/**
 * Contract tests for the advisory CI workflows in `.github/workflows/`.
 *
 * These encode the invariants that were violated in production and cost two
 * permanently-red checks:
 *
 *  - `lighthouse-ci.yml` built the app with no `VITE_SUPABASE_*` env, so
 *    `src/lib/supabase/client.ts` threw at module evaluation, `#root` never
 *    mounted, and every audited route reported `NO_FCP` (Lighthouse's
 *    "page did not paint any content"). The audit only means something if the
 *    build it audits can boot, which requires the same placeholder env the
 *    Validate job uses.
 *  - `pr-review-claude.yml` passed `allowed_tools` / `output_file` to
 *    `anthropics/claude-code-action@v1`, which does not declare them (the run
 *    logged "Unexpected input(s) ..."), and relied on the Claude GitHub App
 *    being installed for the token exchange.
 *
 * They also pin the things a "make it green" edit would be tempted to loosen:
 * the assertion thresholds, the audited routes and the suppression knobs.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import lighthouseConfig from '../../.lighthouserc.cjs'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  const absolute = path.join(repoRoot, relativePath)
  if (!existsSync(absolute)) throw new Error(`missing expected file: ${relativePath}`)
  return readFileSync(absolute, 'utf8')
}

const indentOf = (line: string): number => line.length - line.trimStart().length

/** Lines of the block that starts on `startIndex`, including it. */
function blockAt(lines: string[], startIndex: number): string[] {
  const baseIndent = indentOf(lines[startIndex])
  const block = [lines[startIndex]]
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') {
      block.push(line)
      continue
    }
    if (indentOf(line) <= baseIndent && !line.trimStart().startsWith('#')) break
    block.push(line)
  }
  return block
}

/** The block for a top-level key under `jobs:` (jobs are indented two spaces). */
function jobBlock(text: string, jobName: string): string[] {
  const lines = text.split(/\r?\n/)
  const index = lines.findIndex(line => line === `  ${jobName}:`)
  if (index === -1) throw new Error(`job "${jobName}" not found`)
  return blockAt(lines, index)
}

/** The block for a step whose `uses:` matches `usesFragment`. */
function stepBlock(text: string, usesFragment: string): string[] {
  const lines = text.split(/\r?\n/)
  const usesIndex = lines.findIndex(
    line => line.trim().startsWith('uses:') && line.includes(usesFragment)
  )
  if (usesIndex === -1) throw new Error(`no step uses "${usesFragment}"`)
  return stepBlockAtIndex(lines, usesIndex)
}

function stepBlockAtIndex(lines: string[], from: number): string[] {
  let start = from
  while (start > 0 && !lines[start].trimStart().startsWith('- ')) start -= 1
  return blockAt(lines, start)
}

/** The step block whose `id:` matches `stepId`. */
function stepWithId(text: string, stepId: string): string[] {
  const lines = text.split(/\r?\n/)
  const idIndex = lines.findIndex(line => line.trim() === `id: ${stepId}`)
  if (idIndex === -1) throw new Error(`no step has id "${stepId}"`)
  return stepBlockAtIndex(lines, idIndex)
}

/** Keys of the first `<indent>env:` mapping inside `block`. */
function envKeys(block: string[]): Record<string, string> {
  const envIndex = block.findIndex(line => /^\s*env:\s*$/.test(line))
  if (envIndex === -1) return {}
  const envIndent = indentOf(block[envIndex])
  const keys: Record<string, string> = {}
  for (let i = envIndex + 1; i < block.length; i += 1) {
    const line = block[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (indentOf(line) <= envIndent) break
    const match = /^\s*([A-Z0-9_]+):\s*(.*)$/.exec(line)
    if (match) keys[match[1]] = match[2].trim()
  }
  return keys
}

/** Keys of the first `<indent>with:` mapping inside `block`. */
function withKeys(block: string[]): string[] {
  const withIndex = block.findIndex(line => /^\s*with:\s*$/.test(line))
  if (withIndex === -1) return []
  const withIndent = indentOf(block[withIndex])
  const keys: string[] = []
  for (let i = withIndex + 1; i < block.length; i += 1) {
    const line = block[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (indentOf(line) <= withIndent) break
    const match = /^\s*([A-Za-z0-9_]+):\s*/.exec(line)
    if (match) keys.push(match[1])
  }
  return keys
}

describe('lighthouse-ci.yml', () => {
  const workflow = readRepoFile('.github/workflows/lighthouse-ci.yml')
  const job = jobBlock(workflow, 'lighthouse')

  it('provides the placeholder build env the app needs to mount', () => {
    const env = envKeys(job)
    // Without these the bundle throws in src/lib/supabase/client.ts before
    // React mounts and Lighthouse reports NO_FCP on every route.
    expect(env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL must be set for the audit build').toBeTruthy()
    expect(
      env.VITE_SUPABASE_ANON_KEY,
      'VITE_SUPABASE_ANON_KEY must be set for the audit build'
    ).toBeTruthy()
    // Placeholders only — real keys must never be baked into a CI build.
    // Same values as ci.yml: a resolvable-looking placeholder host, never the
    // project's own https://<ref>.supabase.co.
    expect(env.VITE_SUPABASE_URL).toBe('https://placeholder.supabase.co')
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('ci-placeholder-anon-key')
  })

  it('builds the app before it audits it', () => {
    expect(workflow).toMatch(/npm ci/)
    expect(workflow).toMatch(/npm run build/)
    const buildIndex = workflow.indexOf('npm run build')
    const auditIndex = workflow.indexOf('lighthouse-ci-action')
    expect(buildIndex).toBeGreaterThan(-1)
    expect(auditIndex).toBeGreaterThan(buildIndex)
  })

  it('audits the checked-in LHCI config on Linux with artifacts uploaded', () => {
    const step = stepBlock(workflow, 'treosh/lighthouse-ci-action')
    const text = step.join('\n')
    expect(text).toMatch(/uses:\s*treosh\/lighthouse-ci-action@v12\s*$/m)
    expect(text).toMatch(/configPath:\s*\.lighthouserc\.cjs/)
    expect(text).toMatch(/uploadArtifacts:\s*true/)
  })

  it('does not suppress failures at the step level', () => {
    const step = stepBlock(workflow, 'treosh/lighthouse-ci-action').join('\n')
    expect(step).not.toMatch(/continue-on-error/)
    expect(workflow).not.toMatch(/--no-sandbox/)
    expect(workflow).not.toMatch(/skipAudits|onlyAudits|disableStorageReset/)
  })
})

describe('.lighthouserc.cjs', () => {
  const config = lighthouseConfig

  it('audits every public route against the built preview server', () => {
    expect(config.ci.collect.url).toEqual([
      'http://localhost:4173/',
      'http://localhost:4173/gallery',
      'http://localhost:4173/film',
      'http://localhost:4173/guest-photos',
    ])
    expect(config.ci.collect.startServerCommand).toContain('npm run preview')
    expect(config.ci.collect.startServerCommand).toContain('--strictPort')
    expect(config.ci.collect.numberOfRuns).toBe(1)
  })

  it('keeps the published thresholds — no silent loosening', () => {
    expect(config.ci.assert.assertions['categories:performance']).toEqual([
      'warn',
      { minScore: 0.6 },
    ])
    expect(config.ci.assert.assertions['categories:accessibility']).toEqual([
      'error',
      { minScore: 0.9 },
    ])
    expect(config.ci.assert.assertions['categories:best-practices']).toEqual([
      'warn',
      { minScore: 0.8 },
    ])
    expect(config.ci.assert.assertions['categories:seo']).toEqual(['warn', { minScore: 0.9 }])
  })

  it('has no audit-suppression knobs', () => {
    const raw = readRepoFile('.lighthouserc.cjs')
    expect(raw).not.toMatch(/skipAudits|onlyAudits|disableStorageReset/)
    expect(raw).not.toMatch(/['"]off['"]/)
  })
})

describe('pr-review-claude.yml', () => {
  const workflow = readRepoFile('.github/workflows/pr-review-claude.yml')
  const actionStep = stepBlock(workflow, 'anthropics/claude-code-action')

  // Exactly the `inputs:` declared by anthropics/claude-code-action@v1
  // (commit 8d70a0dd265122bd65b8e09d3d959e65373ae2a1, the ref that @v1
  // resolved to when this test was written). Passing anything else makes the
  // runner log "Unexpected input(s)" and silently drops the setting.
  const VALID_CLAUDE_INPUTS = new Set([
    'trigger_phrase',
    'assignee_trigger',
    'label_trigger',
    'base_branch',
    'branch_prefix',
    'branch_name_template',
    'allowed_bots',
    'allowed_non_write_users',
    'include_comments_by_actor',
    'exclude_comments_by_actor',
    'prompt',
    'settings',
    'anthropic_api_key',
    'claude_code_oauth_token',
    'anthropic_federation_rule_id',
    'anthropic_organization_id',
    'anthropic_service_account_id',
    'anthropic_workspace_id',
    'anthropic_oidc_audience',
    'github_token',
    'use_bedrock',
    'use_vertex',
    'use_foundry',
    'claude_args',
    'additional_permissions',
    'use_sticky_comment',
    'classify_inline_comments',
    'use_commit_signing',
    'ssh_signing_key',
    'bot_id',
    'bot_name',
    'track_progress',
    'include_fix_links',
    'path_to_claude_code_executable',
    'path_to_bun_executable',
    'display_report',
    'show_full_output',
    'plugins',
    'plugin_marketplaces',
  ])

  it('only passes inputs the pinned action actually declares', () => {
    const passed = withKeys(actionStep)
    expect(passed.length).toBeGreaterThan(0)
    const unknown = passed.filter(key => !VALID_CLAUDE_INPUTS.has(key))
    expect(unknown, `unknown action inputs: ${unknown.join(', ')}`).toEqual([])
    // These two were the original bug.
    expect(passed).not.toContain('allowed_tools')
    expect(passed).not.toContain('output_file')
  })

  it('passes github_token so the Claude GitHub App installation is not required', () => {
    const passed = withKeys(actionStep)
    expect(passed).toContain('github_token')
    expect(actionStep.join('\n')).toMatch(/github_token:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/)
  })

  it('pins the action ref instead of floating on a branch', () => {
    expect(actionStep.join('\n')).toMatch(/uses:\s*anthropics\/claude-code-action@v1\s*$/m)
  })

  it('fails with an explicit blocker when no credential exists', () => {
    const credential = stepWithId(workflow, 'credential').join('\n')
    expect(credential).toMatch(/CLAUDE_CODE_OAUTH_TOKEN/)
    expect(credential).toMatch(/::error/)
    expect(credential).toMatch(/exit 1/)
    // The action must be gated on the credential check, not run blind.
    expect(actionStep.join('\n')).toMatch(/if:.*steps\.credential\.outputs\.ready/)
  })

  it('stays manual-dispatch only while Claude review is unprovisioned', () => {
    // No Claude credential is provisioned after the subscription cancellation.
    // An automatic trigger would fail
    // on every PR with a red check nobody can clear, so the lane is manual
    // dispatch only until a credential exists.
    const lines = workflow.split(/\r?\n/)
    const onIndex = lines.findIndex(line => line === 'on:')
    expect(onIndex, 'the workflow must still declare its triggers').toBeGreaterThan(-1)
    // Only the `on:` block itself: the rest of the file mentions pull_request
    // in comments and in the checkout ref.
    const triggers = blockAt(lines, onIndex)
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')
    expect(triggers).not.toMatch(/pull_request:/)
    expect(triggers).toMatch(/workflow_dispatch:/)
    // The manual dispatch must still name its target explicitly.
    expect(triggers).toMatch(/inputs:/)
    // The header must say how to restore automatic reviews, so nobody re-adds
    // the trigger without the credential and gets the red check back.
    expect(workflow).toMatch(/gh secret set CLAUDE_CODE_OAUTH_TOKEN/)
  })

  it('never fakes a review when the credential is missing', () => {
    expect(workflow).not.toMatch(/if:\s*false/)
    expect(workflow).not.toMatch(/fallback review/i)
    // A missing structured review must fail the post step, not be skipped.
    // The post step delegates to the validator below; this pins the wiring so
    // the guard cannot be replaced by an inline `if:` that quietly skips.
    const post = stepWithId(workflow, 'post').join('\n')
    expect(post).toMatch(/node scripts\/ci\/post-claude-review\.mjs/)
    expect(post).not.toMatch(/jq [^\n]*review_markdown/)
  })

  it('never gates posting on the structured output it is supposed to validate', () => {
    const post = stepWithId(workflow, 'post').join('\n')
    const ifLine = post.split(/\r?\n/).find(line => /^\s*if:/.test(line))
    expect(ifLine, 'the post step must keep an explicit if: guard').toBeTruthy()
    // The bug this replaces: `&& steps.review.outputs.structured_output != ''`
    // meant an empty output made the step SKIP, so the `exit 1` that was meant
    // to enforce failure never ran and the job looked merely advisory.
    expect(ifLine).not.toMatch(/structured_output/)
    expect(ifLine).toMatch(/always\(\)/)
    expect(ifLine).toMatch(/steps\.credential\.outputs\.ready/)
  })

  it('resolves and validates an explicit PR target before reviewing', () => {
    const target = stepWithId(workflow, 'target')
    const text = target.join('\n')
    expect(text).toMatch(/node scripts\/ci\/resolve-pr-target\.mjs/)
    const env = envKeys(target)
    expect(env.GH_TOKEN).toMatch(/secrets\.GITHUB_TOKEN/)
    expect(env.INPUT_PR).toMatch(/inputs\.pr/)
    // The reviewed source is the exact resolved SHA, not a moving PR ref or main.
    expect(workflow).toMatch(/ref:\s*\$\{\{ steps\.target\.outputs\.head_sha \}\}/)
    // Manual runs must supply the target; there is no "review whatever is
    // checked out" default. Parsed line by line rather than with one regex:
    // a nested-quantifier pattern over the same lines is a backtracking hazard
    // (CodeQL js/polynomial-redos flagged the first version of this assertion).
    const lines = workflow.split(/\r?\n/)
    const dispatchIndex = lines.findIndex(line => line.trim() === 'workflow_dispatch:')
    expect(dispatchIndex, 'the workflow must still offer workflow_dispatch').toBeGreaterThan(-1)
    const dispatch = blockAt(lines, dispatchIndex).join('\n')
    expect(dispatch).toMatch(/^\s+inputs:$/m)
    expect(dispatch).toMatch(/^\s+pr:$/m)
    expect(dispatch).toMatch(/^\s+required: true$/m)
    expect(dispatch).toMatch(/^\s+type: string$/m)
  })

  it('runs credentialed helpers only from the isolated trusted main checkout', () => {
    const job = jobBlock(workflow, 'review').join('\n')
    expect(job).toMatch(/^\s+id: trusted_helpers$/m)
    const trusted = stepWithId(job, 'trusted_helpers').join('\n')
    expect(trusted).toMatch(/uses: actions\/checkout@v7/)
    expect(trusted).toMatch(/^\s+ref: main$/m)
    expect(trusted).toMatch(/^\s+path: \.$/m)
    expect(trusted).toMatch(/^\s+persist-credentials: false$/m)
    for (const id of ['target', 'post']) {
      const helper = stepWithId(job, id).join('\n')
      expect(helper).toMatch(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
      expect(helper).toMatch(/^\s+working-directory: \$\{\{ github\.workspace \}\}$/m)
      expect(helper).toMatch(/^\s+run: node scripts\/ci\/[\w-]+\.mjs$/m)
    }
    expect(job.indexOf('id: trusted_helpers')).toBeLessThan(job.indexOf('id: target'))
  })

  it('keeps untrusted PR source separate and checks out its resolved immutable head', () => {
    const job = jobBlock(workflow, 'review').join('\n')
    expect(job).toMatch(/^\s+id: source$/m)
    const source = stepWithId(job, 'source').join('\n')
    expect(source).toMatch(/^\s+path: pr-source$/m)
    expect(source).toMatch(/^\s+ref: \$\{\{ steps\.target\.outputs\.head_sha \}\}$/m)
    expect(source).toMatch(/^\s+persist-credentials: false$/m)
    expect(job.indexOf('id: target')).toBeLessThan(job.indexOf('id: source'))
    expect(actionStep.join('\n')).toMatch(/pr-source/)
  })

  it('stages the diff for the model instead of widening its tool permissions', () => {
    const actionText = actionStep.join('\n')
    expect(actionText).toMatch(/--allowedTools Read,Grep,Glob/)
    expect(actionText).not.toMatch(/Bash|mcp__github|--dangerously-skip-permissions/)
    const targetText = stepWithId(workflow, 'target').join('\n')
    expect(targetText).toMatch(/REVIEW_CONTEXT_DIR/)
    expect(actionText).toMatch(/steps\.target\.outputs\.diff_path/)
    // Review permissions stay the ones the job already had.
    const job = jobBlock(workflow, 'review').join('\n')
    expect(job).toMatch(/permissions:\n\s+contents: read\n\s+pull-requests: write/)
    expect(job).not.toMatch(/id-token|security-events|actions: write|contents: write/)
    // Advisory-only policy is preserved, not promoted or bypassed.
    expect(job).toMatch(/continue-on-error: true/)
  })
})

const REVIEW_TARGET_SCRIPT = 'scripts/ci/resolve-pr-target.mjs'
const REVIEW_POST_SCRIPT = 'scripts/ci/post-claude-review.mjs'
const REVIEW_HEAD_SHA = '01603147330ea4ca19268867989bf54631dda99a'
const REVIEW_REPO = 'bbasketballer75/Wedding_Website'
const REVIEW_TOKEN = 'fixture-token-never-print-4c1f'

interface RecordedRequest {
  method: string
  path: string
  accept: string | undefined
  authorization: string | undefined
  body: string
}

interface FakeReply {
  status?: number
  body?: string
  contentType?: string
}

async function startFakeGitHub(
  handler: (request: RecordedRequest) => FakeReply | Promise<FakeReply>
): Promise<{ baseUrl: string; requests: RecordedRequest[]; close: () => Promise<void> }> {
  const requests: RecordedRequest[] = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    const recorded: RecordedRequest = {
      method: request.method ?? '',
      path: request.url ?? '',
      accept: request.headers.accept,
      authorization: request.headers.authorization,
      body: Buffer.concat(chunks).toString('utf8'),
    }
    requests.push(recorded)
    const reply = await handler(recorded)
    response.writeHead(reply.status ?? 200, {
      'content-type': reply.contentType ?? 'application/json',
    })
    response.end(reply.body ?? '')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>(resolve => {
        // Keep-alive sockets from the child's fetch would otherwise hold the
        // listener open until the test times out.
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

function runReviewScript(
  script: string,
  env: Record<string, string>
): Promise<{ status: number | null; stdout: string; stderr: string; combined: string }> {
  // Async spawn: the fake GitHub server below runs in THIS process, so a
  // synchronous child would deadlock waiting for a request nobody can answer.
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(repoRoot, script)], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 30_000)
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('close', status => {
      clearTimeout(timer)
      resolve({ status, stdout, stderr, combined: `${stdout}${stderr}` })
    })
  })
}

function scratchDir(): { dir: string; dispose: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'claude-review-contract-'))
  return {
    dir,
    dispose: () => {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

const pullRequestDoc = (overrides: Record<string, unknown> = {}) => ({
  number: 191,
  state: 'open',
  merged: false,
  draft: false,
  title: 'release candidate',
  additions: 12,
  deletions: 3,
  changed_files: 4,
  base: { ref: 'main', sha: 'b'.repeat(40) },
  head: { sha: REVIEW_HEAD_SHA },
  ...overrides,
})

const REVIEW_DIFF = [
  'diff --git a/src/example.ts b/src/example.ts',
  '--- a/src/example.ts',
  '+++ b/src/example.ts',
  '@@ -1 +1 @@',
  '-const a = 1',
  '+const a = 2',
  '',
].join('\n')

describe('scripts/ci/resolve-pr-target.mjs', () => {
  it('resolves a pull_request event and stages the exact-head diff', async () => {
    const workspace = scratchDir()
    const eventFile = path.join(workspace.dir, 'event.json')
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    const contextDir = path.join(workspace.dir, 'context')
    writeFileSync(
      eventFile,
      JSON.stringify({
        pull_request: { number: 191, head: { sha: REVIEW_HEAD_SHA }, base: { ref: 'main' } },
      })
    )
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(request => {
      if (request.path.endsWith('/pulls/191') && (request.accept ?? '').includes('diff')) {
        return { body: REVIEW_DIFF, contentType: 'application/vnd.github.diff' }
      }
      if (request.path.endsWith('/pulls/191')) {
        return { body: JSON.stringify(pullRequestDoc()) }
      }
      return { status: 404, body: '{"message":"not found"}' }
    })
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: eventFile,
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: contextDir,
      })
      expect(result.status, result.combined).toBe(0)
      const outputs = readFileSync(outputFile, 'utf8')
      expect(outputs).toContain('pr_number=191')
      expect(outputs).toContain(`head_sha=${REVIEW_HEAD_SHA}`)
      expect(outputs).toContain('checkout_ref=refs/pull/191/head')
      expect(readFileSync(path.join(contextDir, 'pr.diff'), 'utf8')).toBe(REVIEW_DIFF)
      const metadata = JSON.parse(readFileSync(path.join(contextDir, 'pr-metadata.json'), 'utf8'))
      expect(metadata.number).toBe(191)
      expect(metadata.base_ref).toBe('main')
      expect(metadata.head_sha).toBe(REVIEW_HEAD_SHA)
      expect(metadata.diff_bytes).toBe(REVIEW_DIFF.length)
      // Bounded: only the named metadata fields reach the model.
      expect(Object.keys(metadata).sort()).toEqual(
        [
          'additions',
          'base_ref',
          'base_sha',
          'changed_files',
          'deletions',
          'diff_bytes',
          'draft',
          'head_sha',
          'number',
          'repo',
          'source',
          'state',
          'title',
        ].sort()
      )
      expect(result.combined).not.toContain(REVIEW_TOKEN)
      expect(github.requests.every(r => (r.authorization ?? '').includes(REVIEW_TOKEN))).toBe(true)
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses a workflow_dispatch run with no explicit PR input', async () => {
    const workspace = scratchDir()
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(() => ({ status: 500, body: '{}' }))
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: path.join(workspace.dir, 'missing-event.json'),
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
        INPUT_PR: '',
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('BLOCKED')
      expect(result.combined).toContain('invalid-pr-input')
      expect(github.requests).toHaveLength(0)
      expect(readFileSync(outputFile, 'utf8')).toBe('')
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses a branch name passed as the manual PR target', async () => {
    const workspace = scratchDir()
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(() => ({ status: 500, body: '{}' }))
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: path.join(workspace.dir, 'missing-event.json'),
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
        INPUT_PR: 'main',
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('invalid-pr-input')
      expect(github.requests).toHaveLength(0)
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses a PR that does not target main', async () => {
    const workspace = scratchDir()
    const eventFile = path.join(workspace.dir, 'event.json')
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(eventFile, JSON.stringify({ pull_request: { number: 191 } }))
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(() => ({
      body: JSON.stringify(pullRequestDoc({ base: { ref: 'develop', sha: 'b'.repeat(40) } })),
    }))
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: eventFile,
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
        INPUT_PR: '191',
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('target-not-main')
      expect(existsSync(path.join(workspace.dir, 'context', 'pr.diff'))).toBe(false)
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses a closed or merged PR', async () => {
    const workspace = scratchDir()
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(() => ({
      body: JSON.stringify(pullRequestDoc({ state: 'closed', merged: true })),
    }))
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: path.join(workspace.dir, 'missing.json'),
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
        INPUT_PR: '191',
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('pr-not-open')
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses an empty diff instead of reviewing nothing', async () => {
    const workspace = scratchDir()
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(request => {
      if ((request.accept ?? '').includes('diff')) return { body: '  \n' }
      return { body: JSON.stringify(pullRequestDoc()) }
    })
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: path.join(workspace.dir, 'missing.json'),
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
        INPUT_PR: '191',
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('empty-diff')
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses when the event head and the PR head disagree', async () => {
    const workspace = scratchDir()
    const eventFile = path.join(workspace.dir, 'event.json')
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(
      eventFile,
      JSON.stringify({
        pull_request: { number: 191, head: { sha: 'c'.repeat(40) }, base: { ref: 'main' } },
      })
    )
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(() => ({ body: JSON.stringify(pullRequestDoc()) }))
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: eventFile,
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('head-drift')
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)

  it('refuses to run without a GitHub token and makes no request', async () => {
    const workspace = scratchDir()
    const outputFile = path.join(workspace.dir, 'github-output.txt')
    writeFileSync(outputFile, '')
    const github = await startFakeGitHub(() => ({ body: '{}' }))
    try {
      const result = await runReviewScript(REVIEW_TARGET_SCRIPT, {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_EVENT_PATH: path.join(workspace.dir, 'missing.json'),
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: '',
        GITHUB_OUTPUT: outputFile,
        REVIEW_CONTEXT_DIR: path.join(workspace.dir, 'context'),
        INPUT_PR: '191',
      })
      expect(result.status).toBe(1)
      expect(result.combined).toContain('missing-token')
      expect(github.requests).toHaveLength(0)
    } finally {
      await github.close()
      workspace.dispose()
    }
  }, 60_000)
})

describe('scripts/ci/post-claude-review.mjs', () => {
  const validReview = '## Summary\n\nLooks good. One minor nit in src/example.ts:2.\n'

  async function runPost(
    env: Record<string, string>,
    handler?: (request: RecordedRequest) => FakeReply | Promise<FakeReply>
  ) {
    const workspace = scratchDir()
    const posted: string[] = []
    const github = await startFakeGitHub(request => {
      if (handler) return handler(request)
      if (request.method === 'GET' && /\/pulls\/191$/.test(request.path)) {
        return { body: JSON.stringify(pullRequestDoc()) }
      }
      if (request.method === 'POST' && /\/issues\/191\/comments$/.test(request.path)) {
        const body = JSON.parse(request.body).body as string
        posted.push(body)
        return { status: 201, body: JSON.stringify({ id: 4242, body }) }
      }
      if (request.method === 'GET' && /\/issues\/comments\/4242$/.test(request.path)) {
        return {
          body: JSON.stringify({ id: 4242, body: posted[posted.length - 1], user: { login: 'x' } }),
        }
      }
      return { status: 404, body: '{"message":"not found"}' }
    })
    try {
      const result = await runReviewScript(REVIEW_POST_SCRIPT, {
        GITHUB_REPOSITORY: REVIEW_REPO,
        GITHUB_API_URL: github.baseUrl,
        GH_TOKEN: REVIEW_TOKEN,
        PR_NUMBER: '191',
        PR_HEAD_SHA: REVIEW_HEAD_SHA,
        REVIEW_OUTCOME: 'success',
        STRUCTURED_OUTPUT: JSON.stringify({ review_markdown: validReview }),
        ...env,
      })
      return { result, requests: github.requests, posted, workspace }
    } finally {
      await github.close()
    }
  }

  it('posts a real review to the intended PR and reads it back', async () => {
    const { result, requests, posted, workspace } = await runPost({})
    try {
      expect(result.status, result.combined).toBe(0)
      expect(posted).toHaveLength(1)
      expect(posted[0]).toContain('Claude review (automated)')
      expect(posted[0]).toContain('Looks good. One minor nit')
      expect(posted[0]).toContain(REVIEW_HEAD_SHA)
      const postCall = requests.find(r => r.method === 'POST')
      expect(postCall?.path).toBe(`/repos/${REVIEW_REPO}/issues/191/comments`)
      const readback = requests.find(r => r.path.endsWith('/issues/comments/4242'))
      expect(readback, 'the posted comment must be read back').toBeTruthy()
      expect(result.stdout).toContain('4242')
      expect(result.combined).not.toContain(REVIEW_TOKEN)
    } finally {
      workspace.dispose()
    }
  }, 60_000)

  it('fails when the action produced no structured output at all', async () => {
    const { result, requests, posted } = await runPost({ STRUCTURED_OUTPUT: '' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('empty-output')
    expect(posted).toHaveLength(0)
    expect(requests.filter(r => r.method === 'POST')).toHaveLength(0)
  }, 60_000)

  it('fails when the structured output has no review_markdown field', async () => {
    const { result, requests } = await runPost({ STRUCTURED_OUTPUT: '{}' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('missing-field')
    expect(requests.filter(r => r.method === 'POST')).toHaveLength(0)
  }, 60_000)

  it('fails when review_markdown is present but blank', async () => {
    const { result, requests } = await runPost({
      STRUCTURED_OUTPUT: JSON.stringify({ review_markdown: '   \n ' }),
    })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('missing-field')
    expect(requests.filter(r => r.method === 'POST')).toHaveLength(0)
  }, 60_000)

  it('fails on malformed JSON instead of posting a blank comment', async () => {
    const { result, requests } = await runPost({ STRUCTURED_OUTPUT: '{"review_markdown":' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('malformed-output')
    expect(requests.filter(r => r.method === 'POST')).toHaveLength(0)
  }, 60_000)

  it('fails when the structured output is not an object', async () => {
    const { result } = await runPost({ STRUCTURED_OUTPUT: '"just a string"' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('malformed-output')
  }, 60_000)

  it('fails when the review action itself failed', async () => {
    const { result, requests } = await runPost({
      REVIEW_OUTCOME: 'failure',
      STRUCTURED_OUTPUT: JSON.stringify({ review_markdown: validReview }),
    })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('action-failure')
    expect(requests.filter(r => r.method === 'POST')).toHaveLength(0)
  }, 60_000)

  it('fails when the review step never ran', async () => {
    const { result } = await runPost({ REVIEW_OUTCOME: 'skipped' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('action-skipped')
  }, 60_000)

  it('fails without a credential and makes no request', async () => {
    const { result, requests } = await runPost({ GH_TOKEN: '' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('missing-token')
    expect(requests).toHaveLength(0)
  }, 60_000)

  it('fails when the PR target is not a number', async () => {
    const { result, requests } = await runPost({ PR_NUMBER: '' })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('invalid-pr-number')
    expect(requests).toHaveLength(0)
  }, 60_000)

  it('fails when the PR moved past the reviewed head', async () => {
    const { result, requests } = await runPost({}, request => {
      if (request.method === 'GET' && /\/pulls\/191$/.test(request.path)) {
        return { body: JSON.stringify(pullRequestDoc({ head: { sha: 'd'.repeat(40) } })) }
      }
      return { status: 500, body: '{}' }
    })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('stale-head')
    expect(requests.filter(r => r.method === 'POST')).toHaveLength(0)
  }, 60_000)

  it('fails when the comment API rejects the post', async () => {
    const { result } = await runPost({}, request => {
      if (request.method === 'GET' && /\/pulls\/191$/.test(request.path)) {
        return { body: JSON.stringify(pullRequestDoc()) }
      }
      return { status: 422, body: '{"message":"unprocessable"}' }
    })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('post-failed')
  }, 60_000)

  it('fails when the comment readback does not match what was posted', async () => {
    const { result } = await runPost({}, request => {
      if (request.method === 'GET' && /\/pulls\/191$/.test(request.path)) {
        return { body: JSON.stringify(pullRequestDoc()) }
      }
      if (request.method === 'POST' && /\/issues\/191\/comments$/.test(request.path)) {
        return { status: 201, body: JSON.stringify({ id: 4242 }) }
      }
      if (request.method === 'GET' && /\/issues\/comments\/4242$/.test(request.path)) {
        return {
          body: JSON.stringify({
            id: 4242,
            body: 'tampered body',
            html_url: `https://github.com/${REVIEW_REPO}/pull/191#issuecomment-4242`,
          }),
        }
      }
      return { status: 404, body: '{}' }
    })
    expect(result.status).toBe(1)
    expect(result.combined).toContain('readback-mismatch')
  }, 60_000)
})
