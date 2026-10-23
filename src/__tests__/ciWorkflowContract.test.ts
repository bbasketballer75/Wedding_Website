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
import { existsSync, readFileSync } from 'node:fs'
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

  it('never fakes a review when the credential is missing', () => {
    expect(workflow).not.toMatch(/if:\s*false/)
    expect(workflow).not.toMatch(/fallback review/i)
    // A missing structured review must fail the post step, not be skipped.
    expect(stepWithId(workflow, 'post').join('\n')).toMatch(/exit 1/)
  })
})
