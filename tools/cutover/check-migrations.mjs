#!/usr/bin/env node
/**
 * tools/cutover/check-migrations.mjs — Wave 9 read-only migration-chain audit.
 *
 * WHAT IT CHECKS
 *   1. Migration chain integrity: filename format, duplicate versions, strict
 *      ordering, and agreement with the migration history table committed in
 *      contracts/schema/INVENTORY.md §2 (version + label, order).
 *   2. Checksums: SHA-256 for every migration (owner-recorded in
 *      docs/rebuild/DATA_CUTOVER.md; drift after cutover starts is visible).
 *   3. Known-defect status:
 *      - D1 (R16): the repaired migration 20260624000000_fix_guestbook_rpc_drop_type.sql
 *        is present, keeps the workbench note and the four semicolons, and the
 *        read RPC no longer selects the dropped `gm.type` column.
 *      - R17: the latest definition of submit_guestbook_message_with_rate_limit
 *        still inserts the dropped guestbook_messages.type column. This is the
 *        documented pre-cutover state; `--expect-r17-fixed` flips the gate for
 *        the cutover window.
 *   4. Greenfield dependency map: every table / RPC / storage bucket / realtime
 *      table referenced by rebuild/src/** is mapped to the migrations that
 *      create or alter it, plus the ordered list of migrations the greenfield app
 *      depends on (and any object with no migration definition).
 *   5. Additive-first cutover ordering: uses the dependency map to print the
 *      baseline set, the superseded legacy-only migrations, and the destructive
 *      statements that must stay out of the additive phase.
 *
 * READ-ONLY BY CONSTRUCTION: only reads files. No writes, no network, no
 * Supabase calls.
 *
 * USAGE
 *   node tools/cutover/check-migrations.mjs                    # human report
 *   node tools/cutover/check-migrations.mjs --json             # machine-readable
 *   node tools/cutover/check-migrations.mjs --expect-r17-fixed # cutover gate
 *
 * Exit codes: 0 = chain + dependency contract OK (R17 known status reported),
 *             1 = mismatch(es), 2 = harness error.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fail, info, ok, step, summary, warn } from '../lib/log.mjs'
import {
  contractSchemaDir,
  loadMigrations,
  normalizeTableRef,
  normalizeWhitespace,
  readText,
  relativeToRepo,
  repoPath,
} from './lib.mjs'

const args = new Set(process.argv.slice(2))
const JSON_OUTPUT = args.has('--json')
const EXPECT_R17_FIXED = args.has('--expect-r17-fixed')

const mismatches = []
const warnings = []

function mismatch(kind, detail, refs = []) {
  mismatches.push({ kind, detail, refs })
}

function warning(kind, detail, refs = []) {
  warnings.push({ kind, detail, refs })
}

// ────────────────────────────────────────────────────────────────────────────
// 1. chain integrity + committed history table
// ────────────────────────────────────────────────────────────────────────────

const MIGRATION_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/

function checkChainIntegrity(migrations) {
  const byVersion = new Map()
  let previousVersion = ''

  for (const migration of migrations) {
    const nameMatch = migration.name.match(MIGRATION_NAME)
    if (!nameMatch) {
      mismatch(
        'migration-filename',
        `migration filename does not match <14 digits>_<label>.sql: ${migration.name}`,
        [migration.file]
      )
      continue
    }
    if (byVersion.has(migration.version)) {
      mismatch(
        'migration-duplicate-version',
        `duplicate migration version ${migration.version}: ${byVersion.get(migration.version).name} and ${migration.name}`,
        [byVersion.get(migration.version).file, migration.file]
      )
    } else {
      byVersion.set(migration.version, migration)
    }
    if (previousVersion && migration.version <= previousVersion) {
      mismatch(
        'migration-order',
        `migration order is not strictly ascending at ${migration.name} (previous version ${previousVersion})`,
        [migration.file]
      )
    }
    previousVersion = migration.version
  }

  return byVersion
}

function readCommittedHistory() {
  const inventoryPath = path.join(contractSchemaDir, 'INVENTORY.md')
  const text = readText(inventoryPath)
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*(\d{14})\s*\|\s*`([^`]+)`\s*\|/)
    if (match) rows.push({ position: Number(match[1]), version: match[2], label: match[3] })
  }
  return { path: 'contracts/schema/INVENTORY.md', rows }
}

function checkCommittedHistory(migrations, history) {
  if (history.rows.length === 0) {
    warning(
      'migration-history-missing',
      'could not parse the migration table from contracts/schema/INVENTORY.md §2'
    )
    return
  }

  const actualByVersion = new Map(migrations.map(migration => [migration.version, migration]))
  const expectedByVersion = new Map(history.rows.map(row => [row.version, row]))

  for (const row of history.rows) {
    const actual = actualByVersion.get(row.version)
    if (!actual) {
      mismatch(
        'migration-missing',
        `INVENTORY.md records migration ${row.version} (${row.label}) but the file is missing`,
        [history.path, 'supabase/migrations']
      )
    } else if (actual.label !== row.label) {
      mismatch(
        'migration-label-drift',
        `INVENTORY.md labels ${row.version} as "${row.label}" but the file label is "${actual.label}"`,
        [history.path, actual.file]
      )
    }
  }
  for (const migration of migrations) {
    if (!expectedByVersion.has(migration.version)) {
      mismatch(
        'migration-untracked',
        `migration ${migration.name} is not recorded in INVENTORY.md §2`,
        [migration.file, history.path]
      )
    }
  }
  if (history.rows.length !== migrations.length) {
    mismatch(
      'migration-count-drift',
      `INVENTORY.md records ${history.rows.length} migrations but supabase/migrations has ${migrations.length}`,
      [history.path, 'supabase/migrations']
    )
  }

  // Same order as the committed history table.
  const positions = new Map(history.rows.map(row => [row.version, row.position]))
  for (const migration of migrations) {
    const position = positions.get(migration.version)
    if (position === undefined) continue
    const expectedPosition =
      migrations.findIndex(candidate => candidate.version === migration.version) + 1
    if (expectedPosition !== position) {
      warning(
        'migration-position-drift',
        `${migration.name} is #${expectedPosition} in filename order but #${position} in INVENTORY.md §2`,
        [migration.file, history.path]
      )
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. checksums (emitted for the cutover record)
// ────────────────────────────────────────────────────────────────────────────

function checksums(migrations) {
  return Object.fromEntries(migrations.map(migration => [migration.name, migration.sha256]))
}

// ────────────────────────────────────────────────────────────────────────────
// 3. known-defect status (D1 repaired read RPC, R17 un-repaired write RPC)
// ────────────────────────────────────────────────────────────────────────────

const D1_MIGRATION = '20260624000000_fix_guestbook_rpc_drop_type.sql'
const R17_MIGRATION = '20260410001200_drop_guestbook_type_and_anniversary.sql'

const CREATE_FUNCTION =
  /create\s+(?:or\s+replace\s+)?function\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)\s*\(/gi

function normalizeFunctionName(rawRef) {
  const cleaned = rawRef.replace(/"/g, '').toLowerCase()
  const parts = cleaned.split('.').filter(Boolean)
  return parts[parts.length - 1]
}

/** Extract the `AS $$ ... $$` body following a function signature match. */
function readFunctionBody(text, fromIndex) {
  const tail = text.slice(fromIndex)
  const bodyMatch = tail.match(/\bas\s+\$\$([\s\S]*?)\$\$/i)
  return bodyMatch ? bodyMatch[1] : ''
}

function checkDefectStatus(migrations) {
  const result = {
    d1: { status: 'missing', evidence: [] },
    r17: { status: 'missing', evidence: [], functionFile: null, line: null },
  }

  // ---- D1: the hand-repaired read RPC migration (R16/R17 family) ----
  const d1 = migrations.find(migration => migration.name === D1_MIGRATION)
  if (!d1) {
    mismatch('d1-migration-missing', `the repaired migration ${D1_MIGRATION} is missing`, [
      'supabase/migrations',
    ])
    result.d1.status = 'missing'
  } else {
    const evidence = []
    const noted = /Workbench note \(2026-11-08\)/.test(d1.text)
    const repairedSemicolons = [
      /drop\s+function\s+if\s+exists\s+public\.get_guestbook_messages_with_comments\(\)\s*;/i,
      /\$\$\s+language\s+plpgsql\s*;/i,
      /grant\s+execute\s+on\s+function\s+public\.get_guestbook_messages_with_comments\(\)\s+to\s+anon\s*;/i,
      /grant\s+execute\s+on\s+function\s+public\.get_guestbook_messages_with_comments\(\)\s+to\s+authenticated\s*;/i,
    ].every(pattern => pattern.test(d1.text))
    const readRpcMatches = [
      ...d1.text.matchAll(
        /create\s+function\s+public\.get_guestbook_messages_with_comments\s*\(/gi
      ),
    ]
    const readRpcMatch = readRpcMatches[readRpcMatches.length - 1]
    const readRpcBody = readRpcMatch ? readFunctionBody(d1.text, readRpcMatch.index) : ''
    const noTypeReference =
      readRpcBody.length > 0 &&
      !/\bgm\.type\b/i.test(readRpcBody) &&
      !/group\s+by[^;]*\btype\b/i.test(readRpcBody)

    evidence.push(
      `workbench-note=${noted}`,
      `four-semicolons=${repairedSemicolons}`,
      `no-type-reference=${noTypeReference}`
    )
    result.d1 = {
      status: noted && repairedSemicolons && noTypeReference ? 'repaired' : 'broken',
      evidence,
      file: d1.file,
    }
    if (result.d1.status === 'broken') {
      mismatch(
        'd1-regression',
        `repaired migration ${D1_MIGRATION} no longer satisfies the repair invariants (${evidence.join(', ')})`,
        [d1.file]
      )
    }
  }

  // ---- R17: latest definition of the rate-limited guestbook submit RPC ----
  let latest = null
  for (const migration of migrations) {
    CREATE_FUNCTION.lastIndex = 0
    for (const match of migration.text.matchAll(CREATE_FUNCTION)) {
      if (normalizeFunctionName(match[1]) !== 'submit_guestbook_message_with_rate_limit') continue
      latest = { migration, index: match.index }
    }
  }

  if (!latest) {
    mismatch(
      'r17-rpc-missing',
      'submit_guestbook_message_with_rate_limit is not defined by any migration',
      ['supabase/migrations']
    )
    result.r17.status = 'missing'
    return result
  }

  const body = readFunctionBody(latest.migration.text, latest.index)
  const signatureText = latest.migration.text.slice(latest.index, latest.index + 400)
  const insertsTypeColumn = /insert\s+into\s+guestbook_messages[\s\S]{0,240}?\btype\b/i.test(body)
  const hasPTypeParameter = /p_type\s+text/i.test(signatureText)
  const dropType = migrations.find(migration => migration.name === R17_MIGRATION)
  const insertIndex = latest.migration.text
    .toLowerCase()
    .indexOf('insert into guestbook_messages', latest.index)
  const evidenceIndex = insertIndex === -1 ? latest.index : insertIndex
  const line = latest.migration.text.slice(0, evidenceIndex).split(/\r?\n/).length

  result.r17 = {
    status: insertsTypeColumn || hasPTypeParameter ? 'unrepaired' : 'repaired',
    functionFile: latest.migration.file,
    line,
    evidence: [
      `inserts-type-column=${insertsTypeColumn}`,
      `has-p_type-parameter=${hasPTypeParameter}`,
      `type-drop-migration=${dropType ? dropType.file : 'missing'}`,
    ],
  }

  if (EXPECT_R17_FIXED && result.r17.status !== 'repaired') {
    mismatch(
      'r17-not-fixed',
      '--expect-r17-fixed was requested but submit_guestbook_message_with_rate_limit still references the dropped type column',
      [latest.migration.file]
    )
  }
  if (!EXPECT_R17_FIXED && result.r17.status === 'repaired') {
    warning(
      'r17-fixed-early',
      'submit_guestbook_message_with_rate_limit appears repaired in the repo; re-run with --expect-r17-fixed to verify the cutover gate',
      [latest.migration.file]
    )
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────
// 4. greenfield dependency map
// ────────────────────────────────────────────────────────────────────────────

/** Recursively list source files under rebuild/src (read-only). */
function listSourceFiles(directory) {
  const files = []
  const stack = [directory]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      else if (
        entry.isFile() &&
        /\.(tsx?|mjs)$/.test(entry.name) &&
        !entry.name.endsWith('.test.ts')
      ) {
        files.push(fullPath)
      }
    }
  }
  return files.sort()
}

function collectGreenfieldReferences() {
  const sourceRoot = repoPath('rebuild', 'src')
  const files = listSourceFiles(sourceRoot)
  const references = new Map() // kind|name -> {kind,name,files:Set}

  const add = (kind, name, file) => {
    const key = `${kind}|${name}`
    let reference = references.get(key)
    if (!reference) {
      reference = { kind, name, files: new Set() }
      references.set(key, reference)
    }
    reference.files.add(relativeToRepo(file))
  }

  for (const file of files) {
    const text = readText(file)
    for (const match of text.matchAll(/storage\.from\(\s*'([^']+)'\s*\)/g)) {
      add('bucket', match[1], file)
    }
    for (const match of text.matchAll(/\.from\(\s*'([a-z_][\w]*)'\s*\)/g)) {
      add('table', match[1], file)
    }
    for (const match of text.matchAll(/\.rpc\(\s*'([a-z_][\w]*)'/g)) {
      add('rpc', match[1], file)
    }
    for (const match of text.matchAll(/\.channel\(\s*'([^']+)'/g)) {
      add('channel', match[1], file)
    }
  }

  return { references: [...references.values()], fileCount: files.length }
}

function buildDefinitionIndex(migrations) {
  const tables = new Map() // name -> Set(migration)
  const functions = new Map()
  const buckets = new Map()
  const publications = new Map()
  const functionBodies = new Map() // name -> {migration, body}

  const push = (map, key, migration) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(migration)
  }

  for (const migration of migrations) {
    const text = migration.text
    for (const match of text.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
    )) {
      push(tables, normalizeTableRef(match[1]), migration)
    }
    for (const match of text.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
    )) {
      push(tables, normalizeTableRef(match[1]), migration)
    }
    for (const match of text.matchAll(
      /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?"?[a-z_][\w$]*"?\s+on\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
    )) {
      push(tables, normalizeTableRef(match[1]), migration)
    }
    for (const match of text.matchAll(
      /create\s+policy\s+"[^"]+"\s+on\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
    )) {
      push(tables, normalizeTableRef(match[1]), migration)
    }
    for (const match of text.matchAll(
      /create\s+(?:or\s+replace\s+)?trigger\s+"?[a-z_][\w$]*"?[\s\S]{0,300}?\bon\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
    )) {
      push(tables, normalizeTableRef(match[1]), migration)
    }
    for (const match of text.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)\s*\(/gi
    )) {
      const name = normalizeFunctionName(match[1])
      push(functions, name, migration)
      functionBodies.set(name, { migration, body: readFunctionBody(text, match.index) })
    }
    for (const match of text.matchAll(/bucket_id\s*=\s*'([^']+)'/g)) {
      push(buckets, match[1], migration)
    }
    for (const match of text.matchAll(/insert\s+into\s+storage\.buckets[^;]*/gi)) {
      for (const nameMatch of match[0].matchAll(/'([^']+)'/g))
        push(buckets, nameMatch[1], migration)
    }
    for (const match of text.matchAll(/alter\s+publication\s+\w+\s+add\s+table\s+([^;]+)/gi)) {
      for (const table of match[1].split(','))
        push(publications, normalizeTableRef(table.trim()), migration)
    }
  }

  return { tables, functions, buckets, publications, functionBodies }
}

function tablesReferencedIn(body, knownTables) {
  const found = new Set()
  for (const match of body.matchAll(
    /\b(?:from|into|update|join|table)\s+(?:public\.)?([a-z_][\w]*)/gi
  )) {
    const name = `public.${match[1].toLowerCase()}`
    if (knownTables.has(name)) found.add(name)
  }
  return found
}

function functionsReferencedIn(body, knownFunctions) {
  const found = new Set()
  for (const match of body.matchAll(/\b([a-z_][\w]*)\s*\(/gi)) {
    const name = match[1].toLowerCase()
    if (knownFunctions.has(name)) found.add(name)
  }
  return found
}

/**
 * Walk the SQL bodies of the RPCs the app calls to find the tables/functions
 * they depend on (e.g. toggle_photo_like_v2 -> photo_likes,
 * submit_guestbook_message_with_rate_limit -> rate_limit_logs/check_rate_limit).
 */
function computeDependencyClosure(index, seedTables, seedFunctions) {
  const tables = new Set(seedTables)
  const functions = new Set(seedFunctions)
  const queue = [
    ...[...seedTables].map(name => ({ kind: 'table', name })),
    ...[...seedFunctions].map(name => ({ kind: 'function', name })),
  ]
  const indirect = []

  while (queue.length > 0) {
    const item = queue.shift()
    if (item.kind !== 'function') continue
    const definition = index.functionBodies.get(item.name)
    if (!definition) continue

    for (const table of tablesReferencedIn(definition.body, index.tables)) {
      if (tables.has(table)) continue
      tables.add(table)
      indirect.push({
        kind: 'table',
        name: table,
        via: `rpc:${item.name}`,
        migration: definition.migration.name,
      })
      queue.push({ kind: 'table', name: table })
    }
    for (const fn of functionsReferencedIn(definition.body, index.functions)) {
      if (functions.has(fn)) continue
      functions.add(fn)
      indirect.push({
        kind: 'rpc',
        name: fn,
        via: `rpc:${item.name}`,
        migration: index.functionBodies.get(fn)?.migration.name ?? null,
      })
      queue.push({ kind: 'function', name: fn })
    }
  }

  return { tables: [...tables], functions: [...functions], indirect }
}

/** Media tile names that are not source-code objects. */
const CHANNEL_TO_TABLE = new Map([['activity_feed', 'public.activity_log']])

function mapGreenfieldDependencies(references, index, migrations) {
  const order = new Map(migrations.map((migration, position) => [migration.name, position]))
  const appDependencies = []
  const appRequired = new Set()
  const seedTables = new Set()
  const seedFunctions = new Set()

  const migrationsFor = objectMigrations =>
    [...objectMigrations].sort(
      (left, right) => (order.get(left.name) ?? 0) - (order.get(right.name) ?? 0)
    )

  for (const reference of references) {
    let candidates = new Set()
    if (reference.kind === 'table') {
      candidates = index.tables.get(`public.${reference.name}`) ?? new Set()
      seedTables.add(`public.${reference.name}`)
    } else if (reference.kind === 'rpc') {
      candidates = index.functions.get(reference.name) ?? new Set()
      seedFunctions.add(reference.name)
    } else if (reference.kind === 'bucket') {
      candidates = index.buckets.get(reference.name) ?? new Set()
    } else if (reference.kind === 'channel') {
      const table = CHANNEL_TO_TABLE.get(reference.name)
      if (table) {
        candidates = index.publications.get(table) ?? index.tables.get(table) ?? new Set()
        seedTables.add(table)
      }
    }

    const mapped = migrationsFor(candidates)
    if (mapped.length === 0) {
      mismatch(
        'app-undefined-object',
        `rebuild/src references ${reference.kind} "${reference.name}" but no migration defines it`,
        [...reference.files]
      )
    }
    for (const migration of mapped) appRequired.add(migration.name)
    appDependencies.push({
      source: 'app-reference',
      kind: reference.kind,
      name: reference.name,
      files: [...reference.files].sort(),
      migrations: mapped.map(migration => migration.name),
      lastMigration: mapped[mapped.length - 1]?.name ?? null,
    })
  }

  const closure = computeDependencyClosure(index, seedTables, seedFunctions)
  const required = new Set(appRequired)
  const indirectDependencies = []

  const addObject = (kind, name, via) => {
    const mapped =
      kind === 'table'
        ? migrationsFor(index.tables.get(name) ?? new Set())
        : migrationsFor(index.functions.get(name) ?? new Set())
    for (const migration of mapped) required.add(migration.name)
    indirectDependencies.push({
      source: 'sql-body',
      kind,
      name,
      via,
      migrations: mapped.map(migration => migration.name),
      lastMigration: mapped[mapped.length - 1]?.name ?? null,
    })
  }

  for (const table of closure.tables) {
    if (!seedTables.has(table)) addObject('table', table, 'referenced by an app RPC')
  }
  for (const fn of closure.functions) {
    if (!seedFunctions.has(fn)) addObject('rpc', fn, 'called by an app RPC')
  }

  return {
    appDependencies: appDependencies.sort((left, right) =>
      `${left.kind}|${left.name}`.localeCompare(`${right.kind}|${right.name}`)
    ),
    indirectDependencies: indirectDependencies.sort((left, right) =>
      `${left.kind}|${left.name}`.localeCompare(`${right.kind}|${right.name}`)
    ),
    required: [...required].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. additive-first cutover ordering
// ────────────────────────────────────────────────────────────────────────────

function buildAdditiveFirstPlan(migrations, required, destructive, schemaDrops) {
  const requiredSet = new Set(required)
  const superseded = migrations.filter(migration => !requiredSet.has(migration.name))

  return {
    steps: [
      {
        order: 1,
        phase: 'baseline (additive, forward-only)',
        detail:
          'Apply the greenfield-required migration set below (or a reviewed 1:1 squash of it) to the ' +
          'cutover database. Nothing is dropped or renamed in this phase.',
        migrations: required,
      },
      {
        order: 2,
        phase: 'cutover migration(s) (additive)',
        detail:
          'Ship the R17 repair and the decided A3 §6 RLS fixes as new forward migrations ' +
          '(docs/rebuild/DATA_CUTOVER.md §owner decisions). No repairs of historical files.',
        migrations: [],
      },
      {
        order: 3,
        phase: 'backfill + validation',
        detail:
          'Run the DATA_CUTOVER verification queries, row-count/checksum comparison and the media URL sweep ' +
          'against the cutover database before any app switch.',
        migrations: [],
      },
      {
        order: 4,
        phase: 'app switch / maintenance window',
        detail:
          'Switch DNS/Netlify to the rebuild (owner credentials, approved window). Legacy stays deployed ' +
          'read-only for rollback.',
        migrations: [],
      },
      {
        order: 5,
        phase: 'cleanup (only after the rollback window)',
        detail:
          `Destructive statements are NOT part of the additive phase: ${destructive.length} top-level ` +
          `destructive statement(s) and ${schemaDrops.length} schema supersession drop(s) exist in the ` +
          `frozen history (see --json). Inventory/DB cleanup is a separate owner-approved migration ` +
          `after the rollback window.`,
        migrations: [],
      },
    ],
    requiredMigrations: required,
    supersededMigrations: superseded.map(migration => ({
      name: migration.name,
      file: migration.file,
      note: 'not required by rebuild/src (legacy-only object iteration, dead or out-of-band bucket)',
    })),
    destructiveStatements: destructive,
    supersededSchemaDrops: schemaDrops,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// run
// ────────────────────────────────────────────────────────────────────────────

function main() {
  const migrations = loadMigrations()
  const history = readCommittedHistory()
  checkChainIntegrity(migrations)
  checkCommittedHistory(migrations, history)
  const defects = checkDefectStatus(migrations)
  const greenfield = collectGreenfieldReferences()
  const index = buildDefinitionIndex(migrations)
  const dependencyMap = mapGreenfieldDependencies(greenfield.references, index, migrations)
  const destructive = collectDestructive(migrations)
  const planWithDestructive = buildAdditiveFirstPlan(
    migrations,
    dependencyMap.required,
    destructive.destructive,
    destructive.schemaDrops
  )

  const result = {
    ok: mismatches.length === 0,
    readOnly: true,
    generatedFrom: {
      migrations: 'supabase/migrations/*.sql',
      history: history.path,
      greenfieldSource: 'rebuild/src/**/*.{ts,tsx}',
    },
    counts: {
      migrations: migrations.length,
      historyRows: history.rows.length,
      greenfieldSourceFiles: greenfield.fileCount,
      greenfieldDependencies: greenfield.references.length,
      indirectDependencies: dependencyMap.indirectDependencies.length,
      requiredMigrations: dependencyMap.required.length,
      supersededMigrations: planWithDestructive.supersededMigrations.length,
      destructiveStatements: destructive.destructive.length,
      supersededSchemaDrops: destructive.schemaDrops.length,
    },
    checksums: checksums(migrations),
    defects,
    appDependencies: dependencyMap.appDependencies,
    indirectDependencies: dependencyMap.indirectDependencies,
    additiveFirstPlan: planWithDestructive,
    mismatches,
    warnings,
  }

  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = result.ok ? 0 : 1
    return
  }

  step('Migration chain')
  ok(`${migrations.length} migrations, versions strictly ascending, no duplicate version`)
  info(`committed history table: ${history.rows.length} rows in ${history.path} §2`)
  info(`checksums (SHA-256) recorded in --json output for the cutover record`)

  step('Known-defect status')
  if (defects.d1.status === 'repaired') {
    ok(`D1/R16 repaired read RPC: invariants hold (${defects.d1.evidence.join(', ')})`)
  } else {
    fail(
      `D1/R16 repaired read RPC: status=${defects.d1.status} (${(defects.d1.evidence ?? []).join(', ')})`
    )
  }
  const r17Label =
    defects.r17.status === 'unrepaired' ? 'UNREPAIRED' : defects.r17.status.toUpperCase()
  warn(
    `R17 guestbook rate-limit RPC: ${r17Label} — latest definition ${defects.r17.functionFile}:${defects.r17.line} ` +
      `(${defects.r17.evidence.join(', ')})`
  )
  if (EXPECT_R17_FIXED) {
    ok('R17 cutover gate (--expect-r17-fixed) satisfied')
  } else {
    info('R17 stays a known pre-cutover defect; the cutover gate is --expect-r17-fixed')
  }

  step('Greenfield dependency map (rebuild/src → migrations)')
  info(
    `scanned ${greenfield.fileCount} source files; ${greenfield.references.length} distinct app object references`
  )
  const dependencyCounts = dependencyMap.appDependencies.reduce((counts, dependency) => {
    counts[dependency.kind] = (counts[dependency.kind] || 0) + 1
    return counts
  }, {})
  ok(
    `mapped references: ${Object.entries(dependencyCounts)
      .map(([kind, count]) => `${count} ${kind}`)
      .join(', ')}`
  )
  ok(`greenfield requires ${dependencyMap.required.length}/${migrations.length} migrations:`)
  for (const migrationName of dependencyMap.required) info(migrationName)
  info(`superseded legacy-only migrations: ${planWithDestructive.supersededMigrations.length}`)
  info(`indirect objects required by the app RPCs: ${dependencyMap.indirectDependencies.length}`)
  for (const dependency of dependencyMap.appDependencies.slice(0, 40)) {
    info(
      `${dependency.kind} ${dependency.name} → ${dependency.lastMigration ?? 'NO MIGRATION'}${
        dependency.files.length > 0
          ? ` (${dependency.files[0]}${dependency.files.length > 1 ? ', …' : ''})`
          : ''
      }`
    )
  }
  if (dependencyMap.appDependencies.length > 40) {
    info(`… ${dependencyMap.appDependencies.length - 40} more dependency rows in --json output`)
  }

  step('Additive-first cutover ordering')
  for (const stepEntry of planWithDestructive.steps) {
    info(`${stepEntry.order}. ${stepEntry.phase}: ${stepEntry.detail}`)
  }
  for (const superseded of planWithDestructive.supersededMigrations) {
    info(`legacy-only (not required): ${superseded.name}`)
  }
  for (const destructiveStatement of destructive.destructive) {
    warn(
      `destructive in history (${destructiveStatement.kind}): ${destructiveStatement.detail} ` +
        `(${destructiveStatement.file}:${destructiveStatement.line})`
    )
  }

  if (warnings.length > 0) {
    step('Warnings')
    for (const entry of warnings) warn(`[${entry.kind}] ${entry.detail}`)
  }

  step('Migration contract')
  if (mismatches.length === 0) {
    summary('RESULT', { mismatches: 0, warnings: warnings.length, migrations: migrations.length })
    ok('migration chain + greenfield dependency map are consistent (read-only check)')
    process.exitCode = 0
  } else {
    summary('RESULT', {
      mismatches: mismatches.length,
      warnings: warnings.length,
      migrations: migrations.length,
    })
    for (const entry of mismatches) {
      fail(
        `[${entry.kind}] ${entry.detail}${entry.refs.length > 0 ? ` (${entry.refs.join(', ')})` : ''}`
      )
    }
    fail('migration contract mismatch — see the entries above/file references')
    process.exitCode = 1
  }
}

// ────────────────────────────────────────────────────────────────────────────
// destructive statement inventory (top-level only, never function bodies)
// ────────────────────────────────────────────────────────────────────────────

function collectDestructive(migrations) {
  const destructive = []
  const schemaDrops = []
  for (const migration of migrations) {
    const text = migration.text
    const lineOf = index => text.slice(0, index).split(/\r?\n/).length

    // Guard: skip dollar-quoted function bodies and comments.
    const dollarRanges = []
    let cursor = 0
    while (cursor < text.length) {
      if (text[cursor] === '$') {
        const tagMatch = text.slice(cursor).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/)
        if (tagMatch) {
          const tag = tagMatch[0]
          const end = text.indexOf(tag, cursor + tag.length)
          if (end === -1) break
          dollarRanges.push([cursor, end + tag.length])
          cursor = end + tag.length
          continue
        }
      }
      cursor += 1
    }
    const blockRanges = []
    cursor = 0
    while (cursor < text.length) {
      const start = text.indexOf('/*', cursor)
      if (start === -1) break
      const end = text.indexOf('*/', start + 2)
      if (end === -1) break
      blockRanges.push([start, end + 2])
      cursor = end + 2
    }
    const isIgnored = index => {
      const lineStart = text.lastIndexOf('\n', index) + 1
      if (text.slice(lineStart, index).includes('--')) return true
      if (blockRanges.some(([start, end]) => index >= start && index < end)) return true
      return dollarRanges.some(([start, end]) => index >= start && index < end)
    }

    for (const match of text.matchAll(/delete\s+from\s+([a-z_][\w.]*)[^;]*/gi)) {
      if (isIgnored(match.index)) continue
      destructive.push({
        kind: 'delete-from',
        file: migration.file,
        line: lineOf(match.index),
        detail: normalizeWhitespace(match[0]).slice(0, 160),
      })
    }
    for (const match of text.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([a-z_][\w.]*)/gi)) {
      if (isIgnored(match.index)) continue
      destructive.push({
        kind: 'drop-table',
        file: migration.file,
        line: lineOf(match.index),
        detail: normalizeWhitespace(match[0]).slice(0, 160),
      })
    }
    for (const match of text.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?([a-z_][\w]*)/gi)) {
      if (isIgnored(match.index)) continue
      schemaDrops.push({
        kind: 'drop-column',
        file: migration.file,
        line: lineOf(match.index),
        detail: normalizeWhitespace(match[0]).slice(0, 160),
      })
    }
    for (const match of text.matchAll(
      /drop\s+function\s+(?:if\s+exists\s+)?([a-z_][\w.]*)\s*\(/gi
    )) {
      if (isIgnored(match.index)) continue
      schemaDrops.push({
        kind: 'drop-function',
        file: migration.file,
        line: lineOf(match.index),
        detail: normalizeWhitespace(match[0]).slice(0, 160),
      })
    }
    for (const match of text.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"/gi)) {
      if (isIgnored(match.index)) continue
      schemaDrops.push({
        kind: 'drop-policy',
        file: migration.file,
        line: lineOf(match.index),
        detail: normalizeWhitespace(match[0]).slice(0, 160),
      })
    }
  }
  return { destructive, schemaDrops }
}

try {
  main()
} catch (error) {
  fail(
    `check-migrations harness error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
  )
  process.exitCode = 2
}
