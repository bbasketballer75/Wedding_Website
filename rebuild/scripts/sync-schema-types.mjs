#!/usr/bin/env node
/* eslint-disable no-undef -- Node CLI script; the app's ESLint flat config only declares browser/node globals for TS files. */
/**
 * sync-schema-types.mjs — one-way sync of the generated Supabase database types
 * into the rebuild app.
 *
 * WHY THIS EXISTS
 * `contracts/schema/database.types.ts` is generated from a clean local Supabase
 * reset (see docs/rebuild/audit/A3-data.md and contracts/schema/INVENTORY.md) and
 * is owned by the contracts baseline. The rebuild app imports the same file from
 * `src/shared/data/database.types.ts` so `createClient<Database>()` is typed
 * against the real schema. The copy must never be hand-edited: this script owns
 * it and `--check` proves it has not drifted.
 *
 * USAGE (from rebuild/)
 *   node scripts/sync-schema-types.mjs           # write the copy
 *   node scripts/sync-schema-types.mjs --check   # exit 1 when out of date (CI)
 *
 * The npm-script aliases (`sync:types`, `check:types`) are added by the Lead in
 * W3-3 (package.json is outside this wave's write scope); until then the two
 * commands above are the contract.
 *
 * The output is formatted with the app's Prettier config so `npm run
 * format:check` and this generated file can never disagree.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const sourcePath = path.join(repoRoot, 'contracts', 'schema', 'database.types.ts')
const targetPath = path.join(repoRoot, 'rebuild', 'src', 'shared', 'data', 'database.types.ts')

const GENERATED_HEADER = `/* eslint-disable @typescript-eslint/no-redundant-type-constituents -- generated Supabase types; do not lint generated unions */
/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: contracts/schema/database.types.ts (generated from a clean local
 * Supabase reset of the frozen migrations; see contracts/schema/INVENTORY.md).
 *
 * Regenerate from the repo root:
 *   node rebuild/scripts/sync-schema-types.mjs
 *
 * Verify the copy is current (CI):
 *   node rebuild/scripts/sync-schema-types.mjs --check
 *
 * Any manual edit here is lost on the next sync and fails the check.
 */
`

const args = new Set(process.argv.slice(2))
const checkMode = args.has('--check')

async function buildExpectedOutput() {
  let source
  try {
    source = await readFile(sourcePath, 'utf8')
  } catch {
    throw new Error(
      `cannot read generated contracts types at ${path.relative(repoRoot, sourcePath)}\n` +
        'Expected the Wave 0 schema baseline to be committed. See contracts/schema/INVENTORY.md.'
    )
  }

  if (!source.includes('export type Database')) {
    throw new Error(
      `${path.relative(repoRoot, sourcePath)} does not look like a Supabase Database type ` +
        '(missing "export type Database"). Refusing to copy a corrupt baseline.'
    )
  }

  const raw = `${GENERATED_HEADER}\n${source.trim()}\n`
  const config = await prettier.resolveConfig(targetPath)

  return prettier.format(raw, { ...config, filepath: targetPath, parser: 'typescript' })
}

async function main() {
  const expected = await buildExpectedOutput()
  const relativeTarget = path.relative(repoRoot, targetPath)

  if (checkMode) {
    let actual
    try {
      actual = await readFile(targetPath, 'utf8')
    } catch {
      console.error(
        `✗ ${relativeTarget} is missing — run: node rebuild/scripts/sync-schema-types.mjs`
      )
      process.exitCode = 1
      return
    }

    if (actual !== expected) {
      console.error(
        `✗ ${relativeTarget} is out of date with contracts/schema/database.types.ts\n` +
          '  run: node rebuild/scripts/sync-schema-types.mjs'
      )
      process.exitCode = 1
      return
    }

    console.log(`✓ ${relativeTarget} is in sync with contracts/schema/database.types.ts`)
    return
  }

  await writeFile(targetPath, expected, 'utf8')
  console.log(`✓ wrote ${relativeTarget} from contracts/schema/database.types.ts`)
}

main().catch(error => {
  console.error(
    `✗ sync-schema-types failed: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exitCode = 1
})
