/**
 * Shared path constants for the refactor workbench.
 *
 * tools/ is plain Node ESM (deliberately: no build step, no tsconfig surface),
 * so every script resolves the repository root the same way: two directories up
 * from this file.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const repoPath = (...segments) => path.join(repoRoot, ...segments)

export const contractsDir = repoPath('contracts')
export const schemaDir = repoPath('contracts', 'schema')
export const contentDir = repoPath('contracts', 'content')
export const renderedContentDir = repoPath('contracts', 'content', 'rendered')
export const fixturesDir = repoPath('contracts', 'fixtures')
export const mediaDir = repoPath('contracts', 'media')
export const baselineDir = repoPath('contracts', 'baseline')
export const docsRebuildDir = repoPath('docs', 'rebuild')
export const auditDir = repoPath('docs', 'rebuild', 'audit')
export const parityOutputDir = repoPath('tools', 'parity', 'output')

/**
 * Annotated tag that freezes the legacy app as the parity oracle.
 * Override with FREEZE_TAG for a different freeze point.
 */
export const FREEZE_TAG = process.env.FREEZE_TAG || 'legacy-freeze-2026-11-08'
