#!/usr/bin/env node
/**
 * tools/cutover/check-data.mjs — Wave 9 read-only data + media completeness check.
 *
 * WHAT IT CHECKS
 *   1. Schema contract vs the frozen migration chain:
 *      - tables / columns, RLS policies (public + storage), RPC signatures, triggers
 *        expected by replaying supabase/migrations/*.sql
 *        vs present in contracts/schema/schema.sql (+ storage.sql for storage policies).
 *   2. Media inventory coverage: every media-looking path referenced by
 *      contracts/content/**, contracts/fixtures/** and contracts/schema/fixtures.sql
 *      is either a local file that exists under public/ or matches a declared CDN /
 *      Storage bucket in contracts/media/INVENTORY.json; the inventory's local media
 *      counts/sizes and git-tracking claims are re-measured from the filesystem.
 *   3. Cross-checks: the frozen offload prefix contract in
 *      rebuild/src/shared/data/media.ts against the inventory, and the media host
 *      CSP allowlist in public/_headers against the media contract.
 *
 * READ-ONLY BY CONSTRUCTION: this script only reads files / runs `git ls-files`.
 * It never writes, never calls Supabase, and never mutates the repo.
 *
 * USAGE
 *   node tools/cutover/check-data.mjs          # human report; exit 1 on mismatch
 *   node tools/cutover/check-data.mjs --json   # machine-readable result
 *
 * Exit codes: 0 = all checks pass, 1 = mismatch(es) found, 2 = harness error.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fail, info, ok, step, summary, warn } from '../lib/log.mjs'
import {
  contractMediaDir,
  contractSchemaDir,
  findMediaReferences,
  globToRegExp,
  loadMigrations,
  normalizeTableRef,
  normalizeWhitespace,
  readJsonFile,
  readText,
  relativeToRepo,
  repoPath,
  sortByKey,
  statMediaDirectory,
  unquote,
} from './lib.mjs'

const args = new Set(process.argv.slice(2))
const JSON_OUTPUT = args.has('--json')
const IGNORE_KNOWN = args.has('--ignore-known')

const mismatches = []
const warnings = []
const knownFindings = []

/**
 * Documented, owner-visible defects that are expected to fail this checker until
 * their owning wave lands. They stay mismatches by default (strict cutover gate);
 * `--ignore-known` re-classifies them as known findings so the checker proves
 * "no *unknown* mismatch" while the report still lists them.
 */
const KNOWN_ALLOWLIST = [
  {
    kind: 'media-missing-local-file',
    identifier: '/images/og-image.webp',
    risk: 'R21',
    reason:
      'Static og:image referenced by rendered content; the file is intentionally absent on the ' +
      'frozen baseline (A4 §5 / R21). Wave 8 SEO work owns the real image or a corrected tag.',
  },
]

function findKnown(kind, identifier) {
  return KNOWN_ALLOWLIST.find(entry => entry.kind === kind && entry.identifier === identifier)
}

function mismatch(kind, detail, refs = []) {
  mismatches.push({ kind, detail, refs })
}

function warning(kind, detail, refs = []) {
  warnings.push({ kind, detail, refs })
}

// ────────────────────────────────────────────────────────────────────────────
// Small SQL scanning helpers (only the statement shapes this repo uses)
// ────────────────────────────────────────────────────────────────────────────

/** Find the index of the `)` matching the `(` at openIndex (quote-aware). */
function findMatchingParen(text, openIndex) {
  let depth = 0
  let mode = 'code'
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index]
    if (mode === 'code') {
      if (char === "'") mode = 'single'
      else if (char === '"') mode = 'double'
      else if (char === '(') depth += 1
      else if (char === ')') {
        depth -= 1
        if (depth === 0) return index
      }
    } else if (mode === 'single') {
      if (char === "'" && text[index + 1] !== "'") mode = 'code'
      else if (char === "'" && text[index + 1] === "'") index += 1
    } else if (mode === 'double') {
      if (char === '"' && text[index + 1] !== '"') mode = 'code'
      else if (char === '"' && text[index + 1] === '"') index += 1
    }
  }
  return -1
}

/** Split on a separator at paren/bracket/quote depth 0. */
function splitTopLevel(text, separator = ',') {
  const parts = []
  let current = ''
  let depth = 0
  let mode = 'code'
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (mode === 'code') {
      if (char === "'") mode = 'single'
      else if (char === '"') mode = 'double'
      else if (char === '(' || char === '[' || char === '{') depth += 1
      else if (char === ')' || char === ']' || char === '}') depth -= 1
    } else if (mode === 'single') {
      if (char === "'" && text[index + 1] !== "'") mode = 'code'
      else if (char === "'" && text[index + 1] === "'") index += 1
    } else if (mode === 'double') {
      if (char === '"' && text[index + 1] !== '"') mode = 'code'
      else if (char === '"' && text[index + 1] === '"') index += 1
    }
    if (char === separator && depth === 0 && mode === 'code') {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current)
  return parts
}

/** Index of the next top-level `;` from startIndex (quote-aware). */
function findStatementEnd(text, startIndex) {
  let mode = 'code'
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]
    if (mode === 'code') {
      if (char === "'") mode = 'single'
      else if (char === '"') mode = 'double'
      else if (char === ';') return index
    } else if (mode === 'single') {
      if (char === "'" && text[index + 1] !== "'") mode = 'code'
      else if (char === "'" && text[index + 1] === "'") index += 1
    } else if (mode === 'double') {
      if (char === '"' && text[index + 1] !== '"') mode = 'code'
      else if (char === '"' && text[index + 1] === '"') index += 1
    }
  }
  return text.length
}

const TYPE_ALIASES = new Map([
  ['timestamptz', 'timestamp with time zone'],
  ['timestamp with time zone', 'timestamp with time zone'],
  ['timestamp without time zone', 'timestamp without time zone'],
  ['int', 'integer'],
  ['int4', 'integer'],
  ['int8', 'bigint'],
  ['bool', 'boolean'],
  ['varchar', 'character varying'],
  ['float8', 'double precision'],
  ['double precision', 'double precision'],
])

function normalizeType(rawType) {
  let type = unquote(normalizeWhitespace(rawType)).toLowerCase()
  type = type.replace(/\s+/g, ' ').trim()
  if (TYPE_ALIASES.has(type)) return TYPE_ALIASES.get(type)
  // Preserve [] suffixes while aliasing the base type.
  const arrayMatch = type.match(/^(.*)(\[\])$/)
  if (arrayMatch && TYPE_ALIASES.has(arrayMatch[1])) return `${TYPE_ALIASES.get(arrayMatch[1])}[]`
  return type
}

/** Normalise one function parameter to its type (param name and default removed). */
function normalizeFunctionParam(paramText) {
  let param = normalizeWhitespace(paramText)
  if (!param) return null
  param = param.replace(/\s+default\s+[\s\S]*$/i, '').trim()
  // Strip a leading parameter name (migrations and dumps always name params).
  const nameMatch = param.match(/^"?([a-zA-Z_][\w$]*)"?\s+/)
  if (nameMatch) param = param.slice(nameMatch[0].length)
  return normalizeType(param)
}

/** Parse a migration/dump argument list into a canonical signature key. */
function parseFunctionSignature(argsText) {
  const types = []
  for (const part of splitTopLevel(argsText)) {
    const type = normalizeFunctionParam(part)
    if (type) types.push(type)
  }
  return { types, key: types.join(',') }
}

// ────────────────────────────────────────────────────────────────────────────
// arm 1: expected schema, replayed from the frozen migration chain
// ────────────────────────────────────────────────────────────────────────────

const CREATE_TABLE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)\s*\(/gi
const ALTER_TABLE =
  /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
const CREATE_POLICY =
  /create\s+policy\s+"([^"]+)"\s+on\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
const DROP_POLICY =
  /drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/gi
const CREATE_FUNCTION =
  /create\s+(?:or\s+replace\s+)?function\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)\s*\(/gi
const DROP_FUNCTION =
  /drop\s+function\s+(?:if\s+exists\s+)?((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)\s*\(([^)]*)\)/gi
const CREATE_TRIGGER = /create\s+(?:or\s+replace\s+)?trigger\s+"?([a-z_][\w$]*)"?/gi

function parseCreateTableBody(body) {
  const columns = new Set()
  for (const part of splitTopLevel(body)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (/^(constraint|primary\s+key|unique|check|foreign\s+key|exclude|like)\b/i.test(trimmed))
      continue
    const nameMatch = trimmed.match(/^"?([a-zA-Z_][\w$]*)"?/)
    if (nameMatch) columns.add(nameMatch[1].toLowerCase())
  }
  return columns
}

/** Normalise a function reference to its bare name (functions are all in public). */
function normalizeFunctionName(rawRef) {
  const cleaned = unquote(rawRef).toLowerCase()
  const parts = cleaned.split('.').filter(Boolean)
  return parts[parts.length - 1]
}

function collectDollarRanges(text) {
  const ranges = []
  let index = 0
  while (index < text.length) {
    if (text[index] === '$') {
      const tagMatch = text.slice(index).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/)
      if (tagMatch) {
        const tag = tagMatch[0]
        const end = text.indexOf(tag, index + tag.length)
        if (end === -1) break
        ranges.push([index, end + tag.length])
        index = end + tag.length
        continue
      }
    }
    index += 1
  }
  return ranges
}

function collectBlockCommentRanges(text) {
  const ranges = []
  let index = 0
  while (index < text.length) {
    const start = text.indexOf('/*', index)
    if (start === -1) break
    const end = text.indexOf('*/', start + 2)
    if (end === -1) break
    ranges.push([start, end + 2])
    index = end + 2
  }
  return ranges
}

function isInComment(text, blockCommentRanges, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  if (text.slice(lineStart, index).includes('--')) return true
  return blockCommentRanges.some(([start, end]) => index >= start && index < end)
}

function replayMigrations(migrations) {
  const tables = new Map() // name -> {columns:Set, file}
  const policies = new Map() // schema.table::name -> {name,target,file}
  const functions = new Map() // name -> {types,key,file}
  const triggers = new Map() // schema.table::name -> {name,target,file}
  const destructive = []
  const schemaDrops = []

  const lineOf = (text, index) => text.slice(0, index).split(/\r?\n/).length

  for (const migration of migrations) {
    const text = migration.text
    const dollarRanges = collectDollarRanges(text)
    const blockCommentRanges = collectBlockCommentRanges(text)
    const isInDollarBody = index =>
      dollarRanges.some(([start, end]) => index >= start && index < end)
    const isIgnored = index => isInDollarBody(index) || isInComment(text, blockCommentRanges, index)

    // 1. Collect every relevant statement with its position, then replay in
    //    source order. Order matters: several migrations DROP + CREATE the same
    //    policy/RPC inside one file (e.g. the admin-role atomic swap and the R17
    //    repair), and per-category passes would mis-order those.
    const operations = []
    const record = (type, match, extra = {}) =>
      operations.push({ type, index: match.index, end: match.index + match[0].length, ...extra })

    for (const match of text.matchAll(CREATE_TABLE)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('create-table', match, { rawTable: match[1] })
    }
    for (const match of text.matchAll(ALTER_TABLE)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('alter-table', match, { rawTable: match[1] })
    }
    for (const match of text.matchAll(CREATE_POLICY)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('create-policy', match, { name: match[1], rawTarget: match[2] })
    }
    for (const match of text.matchAll(DROP_POLICY)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('drop-policy', match, { name: match[1], rawTarget: match[2] })
    }
    for (const match of text.matchAll(CREATE_FUNCTION)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('create-function', match, { rawName: match[1] })
    }
    for (const match of text.matchAll(DROP_FUNCTION)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('drop-function', match, { rawName: match[1], argsText: match[2] })
    }
    for (const match of text.matchAll(CREATE_TRIGGER)) {
      if (isInComment(text, blockCommentRanges, match.index)) continue
      record('create-trigger', match, { name: match[1] })
    }
    operations.sort((left, right) => left.index - right.index)

    for (const operation of operations) {
      if (operation.type === 'create-table') {
        const openIndex = operation.end - 1
        const closeIndex = findMatchingParen(text, openIndex)
        if (closeIndex === -1) {
          warning(
            'schema-parse',
            `unbalanced CREATE TABLE in ${migration.file}:${lineOf(text, operation.index)}`
          )
          continue
        }
        const table = normalizeTableRef(operation.rawTable)
        const columns = parseCreateTableBody(text.slice(openIndex + 1, closeIndex))
        tables.set(table, { columns, file: migration.file })
        continue
      }

      if (operation.type === 'alter-table') {
        const table = normalizeTableRef(operation.rawTable)
        const endIndex = findStatementEnd(text, operation.end)
        const segment = text.slice(operation.index, endIndex)
        if (!tables.has(table)) tables.set(table, { columns: new Set(), file: migration.file })
        const entry = tables.get(table)

        for (const add of segment.matchAll(
          /add\s+column\s+(?:if\s+not\s+exists\s+)?("?[a-zA-Z_][\w$]*"?)/gi
        )) {
          entry.columns.add(unquote(add[1]).toLowerCase())
        }
        for (const drop of segment.matchAll(
          /drop\s+column\s+(?:if\s+exists\s+)?("?[a-zA-Z_][\w$]*"?)/gi
        )) {
          entry.columns.delete(unquote(drop[1]).toLowerCase())
          schemaDrops.push({
            kind: 'drop-column',
            file: migration.file,
            line: lineOf(text, operation.index),
            detail: normalizeWhitespace(segment).slice(0, 140),
          })
        }
        for (const rename of segment.matchAll(
          /rename\s+column\s+("?[a-zA-Z_][\w$]*"?)\s+to\s+("?[a-zA-Z_][\w$]*"?)/gi
        )) {
          entry.columns.delete(unquote(rename[1]).toLowerCase())
          entry.columns.add(unquote(rename[2]).toLowerCase())
        }
        continue
      }

      if (operation.type === 'create-policy') {
        const target = normalizeTableRef(operation.rawTarget)
        policies.set(`${target}::${operation.name}`, {
          name: operation.name,
          target,
          file: migration.file,
        })
        continue
      }

      if (operation.type === 'drop-policy') {
        const target = normalizeTableRef(operation.rawTarget)
        policies.delete(`${target}::${operation.name}`)
        schemaDrops.push({
          kind: 'drop-policy',
          file: migration.file,
          line: lineOf(text, operation.index),
          detail: `policy "${operation.name}" on ${target}`,
        })
        continue
      }

      if (operation.type === 'create-function') {
        const name = normalizeFunctionName(operation.rawName)
        const openIndex = operation.end - 1
        const closeIndex = findMatchingParen(text, openIndex)
        if (closeIndex === -1) {
          warning(
            'schema-parse',
            `unbalanced CREATE FUNCTION in ${migration.file}:${lineOf(text, operation.index)}`
          )
          continue
        }
        const signature = parseFunctionSignature(text.slice(openIndex + 1, closeIndex))
        functions.set(name, { ...signature, file: migration.file })
        continue
      }

      if (operation.type === 'drop-function') {
        const name = normalizeFunctionName(operation.rawName)
        const signature = parseFunctionSignature(operation.argsText)
        if (!signature.key) {
          functions.delete(name)
        } else {
          const existing = functions.get(name)
          if (!existing || existing.key === signature.key) functions.delete(name)
        }
        schemaDrops.push({
          kind: 'drop-function',
          file: migration.file,
          line: lineOf(text, operation.index),
          detail: `${name}(${signature.key})`,
        })
        continue
      }

      if (operation.type === 'create-trigger') {
        const endIndex = findStatementEnd(text, operation.end)
        const segment = text.slice(operation.index, endIndex)
        const targetMatch = segment.match(/\bon\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)/i)
        if (!targetMatch) {
          warning(
            'schema-parse',
            `could not parse trigger target in ${migration.file}:${lineOf(text, operation.index)}`
          )
          continue
        }
        const target = normalizeTableRef(targetMatch[1])
        triggers.set(`${target}::${operation.name}`, {
          name: operation.name,
          target,
          file: migration.file,
        })
      }
    }

    // 2. Top-level data-destructive statements (never inside function bodies).
    for (const deleteMatch of text.matchAll(
      /delete\s+from\s+((?:"?[a-z_][\w$]*"?\.)?"?[a-z_][\w$]*"?)[^;]*/gi
    )) {
      if (isIgnored(deleteMatch.index)) continue
      destructive.push({
        kind: 'delete-from',
        file: migration.file,
        line: lineOf(text, deleteMatch.index),
        detail: normalizeWhitespace(deleteMatch[0]).slice(0, 160),
      })
    }
    for (const dropTable of text.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([^;]+)/gi)) {
      if (isIgnored(dropTable.index)) continue
      destructive.push({
        kind: 'drop-table',
        file: migration.file,
        line: lineOf(text, dropTable.index),
        detail: normalizeWhitespace(dropTable[0]).slice(0, 160),
      })
    }
  }

  return { tables, policies, functions, triggers, destructive, schemaDrops }
}
// ────────────────────────────────────────────────────────────────────────────
// arm 2: actual schema present in the committed contract dumps
// ────────────────────────────────────────────────────────────────────────────

function parseSchemaDump() {
  const schemaText = readText(path.join(contractSchemaDir, 'schema.sql'))
  const storageText = readText(path.join(contractSchemaDir, 'storage.sql'))

  const tables = new Map() // name -> Set(columns)
  const schemaLines = schemaText.split(/\r?\n/)
  for (let index = 0; index < schemaLines.length; index += 1) {
    const line = schemaLines[index]
    const match = line.match(/^CREATE TABLE IF NOT EXISTS "public"\."([^"]+)" \($/)
    if (!match) continue
    const columns = new Set()
    let cursor = index + 1
    while (cursor < schemaLines.length && !/^\);$/.test(schemaLines[cursor])) {
      const columnMatch = schemaLines[cursor].match(/^\s{4}"([^"]+)"\s/)
      if (columnMatch) columns.add(columnMatch[1].toLowerCase())
      cursor += 1
    }
    tables.set(`public.${match[1].toLowerCase()}`, columns)
    index = cursor
  }

  const policies = new Map()
  for (const line of schemaText.split(/\r?\n/)) {
    const match = line.match(/^CREATE POLICY "([^"]+)" ON "public"\."([^"]+)"/)
    if (match)
      policies.set(`public.${match[2]}::${match[1]}`, { file: 'contracts/schema/schema.sql' })
  }
  for (const line of storageText.split(/\r?\n/)) {
    const match = line.match(/^CREATE POLICY "([^"]+)" ON "storage"\."([^"]+)"/)
    if (match)
      policies.set(`storage.${match[2]}::${match[1]}`, { file: 'contracts/schema/storage.sql' })
  }

  const functions = new Map()
  const functionRe = /^CREATE OR REPLACE FUNCTION "public"\."([^"]+)"\((.*?)\)\s+RETURNS/gm
  for (const match of schemaText.matchAll(functionRe)) {
    functions.set(match[1].toLowerCase(), parseFunctionSignature(match[2]))
  }

  const triggers = new Map()
  const triggerRe = /^CREATE OR REPLACE TRIGGER "([^"]+)"[^\n]*?\bON "public"\."([^"]+)"/gm
  for (const match of schemaText.matchAll(triggerRe)) {
    triggers.set(`public.${match[2]}::${match[1]}`, { file: 'contracts/schema/schema.sql' })
  }

  return {
    tables,
    policies,
    functions,
    triggers,
    files: ['contracts/schema/schema.sql', 'contracts/schema/storage.sql'],
  }
}

// ────────────────────────────────────────────────────────────────────────────
// schema comparison
// ────────────────────────────────────────────────────────────────────────────

function compareSchema(expected, actual) {
  const counts = {
    migrations: expected.migrations,
    tables: { expected: expected.tables.size, contract: actual.tables.size, matched: 0 },
    columns: { expected: 0, contract: 0, matched: 0 },
    policies: {
      expected: expected.policies.size,
      contract: actual.policies.size,
      matched: 0,
      public: 0,
      storage: 0,
    },
    functions: { expected: expected.functions.size, contract: actual.functions.size, matched: 0 },
    triggers: { expected: expected.triggers.size, contract: actual.triggers.size, matched: 0 },
  }

  for (const [name, expectedColumns] of sortByKey(expected.tables.entries())) {
    counts.columns.expected += expectedColumns.columns.size
    const actualColumns = actual.tables.get(name)
    if (!actualColumns) {
      mismatch(
        'schema-missing-table',
        `table "${name}" is defined by migrations but missing from contracts/schema/schema.sql`,
        [expectedColumns.file, 'contracts/schema/schema.sql']
      )
      continue
    }
    counts.tables.matched += 1
    for (const column of sortByKey(expectedColumns.columns)) {
      if (!actualColumns.has(column)) {
        mismatch(
          'schema-missing-column',
          `column ${name}.${column} is defined by migrations but missing from contracts/schema/schema.sql`,
          [expectedColumns.file, 'contracts/schema/schema.sql']
        )
        continue
      }
      counts.columns.matched += 1
    }
    for (const column of sortByKey(actualColumns)) {
      if (!expectedColumns.columns.has(column)) {
        mismatch(
          'schema-extra-column',
          `column ${name}.${column} exists in contracts/schema/schema.sql but no migration defines it (drift/undocumented repair)`,
          [expectedColumns.file, 'contracts/schema/schema.sql']
        )
      }
    }
  }
  for (const [name, actualColumns] of sortByKey(actual.tables.entries())) {
    counts.columns.contract += actualColumns.size
    if (!expected.tables.has(name)) {
      mismatch(
        'schema-extra-table',
        `table "${name}" exists in contracts/schema/schema.sql but no migration creates it`,
        ['contracts/schema/schema.sql']
      )
    }
  }

  for (const [key, expectedPolicy] of sortByKey(expected.policies.entries())) {
    const [target] = key.split('::')
    if (target.startsWith('storage.')) counts.policies.storage += 1
    else counts.policies.public += 1
    if (!actual.policies.has(key)) {
      mismatch(
        'schema-missing-policy',
        `policy "${expectedPolicy.name}" on ${expectedPolicy.target} is created by migrations but missing from the committed schema dump`,
        [expectedPolicy.file, ...actual.files]
      )
      continue
    }
    counts.policies.matched += 1
  }
  for (const [key] of sortByKey(actual.policies.entries())) {
    if (!expected.policies.has(key)) {
      const [target, name] = key.split('::')
      mismatch(
        'schema-extra-policy',
        `policy "${name}" on ${target} exists in the committed schema dump but no migration creates it`,
        [...actual.files]
      )
    }
  }

  for (const [name, expectedFunction] of sortByKey(expected.functions.entries())) {
    const actualFunction = actual.functions.get(name)
    if (!actualFunction) {
      mismatch(
        'schema-missing-rpc',
        `RPC "${name}(${expectedFunction.key})" is defined by migrations but missing from contracts/schema/schema.sql`,
        [expectedFunction.file, 'contracts/schema/schema.sql']
      )
      continue
    }
    if (actualFunction.key !== expectedFunction.key) {
      mismatch(
        'schema-rpc-signature',
        `RPC "${name}" signature drift: migrations define (${expectedFunction.key}) but schema dump has (${actualFunction.key})`,
        [expectedFunction.file, 'contracts/schema/schema.sql']
      )
      continue
    }
    counts.functions.matched += 1
  }
  for (const [name] of sortByKey(actual.functions.entries())) {
    if (!expected.functions.has(name)) {
      mismatch(
        'schema-extra-rpc',
        `RPC "${name}" exists in contracts/schema/schema.sql but no migration defines it`,
        ['contracts/schema/schema.sql']
      )
    }
  }

  for (const [key, expectedTrigger] of sortByKey(expected.triggers.entries())) {
    if (!actual.triggers.has(key)) {
      mismatch(
        'schema-missing-trigger',
        `trigger "${expectedTrigger.name}" on ${expectedTrigger.target} is created by migrations but missing from contracts/schema/schema.sql`,
        [expectedTrigger.file, 'contracts/schema/schema.sql']
      )
      continue
    }
    counts.triggers.matched += 1
  }

  return counts
}

// ────────────────────────────────────────────────────────────────────────────
// media inventory coverage
// ────────────────────────────────────────────────────────────────────────────

const MEDIA_REFERENCE_FILES = {
  content: repoPath('contracts', 'content'),
  fixtures: repoPath('contracts', 'fixtures'),
}

function listJsonFilesRecursive(directory) {
  const files = []
  const stack = [directory]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSyncSafe(current)) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(fullPath)
    }
  }
  return files.sort()
}

function readdirSyncSafe(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

function normalizeUrlPath(value) {
  if (value.startsWith('http')) {
    try {
      return new URL(value).pathname
    } catch {
      return null
    }
  }
  return value.split(/[?#]/)[0]
}

function classifyRelativePath(pathname, model) {
  for (const prefix of model.offloadPrefixes) {
    if (pathname.startsWith(prefix)) return { kind: 'offloaded', pathname }
  }
  const localEntry = model.localDirs.find(entry => pathname.startsWith(entry.urlPrefix))
  if (localEntry) return { kind: 'local', pathname, localEntry }
  return { kind: 'unknown-relative', pathname }
}

function classifyMediaReference(reference, model) {
  const value = reference.value
  if (value.startsWith('/__media_proxy')) return { kind: 'dev-proxy' }

  if (/^https?:\/\//.test(value)) {
    let hostname = ''
    let pathname = ''
    try {
      const url = new URL(value)
      hostname = url.hostname.toLowerCase()
      pathname = url.pathname
    } catch {
      return { kind: 'malformed-absolute' }
    }
    if (hostname === 'media.wedding.theporadas.com') {
      return { kind: 'offloaded', pathname, via: 'cdn' }
    }
    if (hostname.endsWith('.supabase.co')) return { kind: 'supabase-storage', hostname }
    if (model.siteHosts.has(hostname)) {
      // Absolute site-origin URLs (OG/meta images) resolve through the same
      // public/ tree; report them as local so they are existence-checked.
      return { ...classifyRelativePath(pathname, model), via: 'site-origin' }
    }
    if (model.syntheticHosts.has(hostname)) return { kind: 'synthetic-absolute', hostname }
    return { kind: 'external-absolute', hostname }
  }

  const pathname = normalizeUrlPath(value) || value
  return classifyRelativePath(pathname, model)
}
function loadMediaModel() {
  const inventory = readJsonFile(path.join(contractMediaDir, 'INVENTORY.json'))
  const buckets = (inventory.buckets || []).map(bucket => ({
    ...bucket,
    patterns: (bucket.pathPatterns || []).map(pattern => ({
      pattern,
      regex: globToRegExp(pattern),
    })),
  }))
  const siteHosts = new Set([
    'www.theporadas.com',
    'theporadas.com',
    'wedding.theporadas.com',
    'localhost',
  ])
  const syntheticHosts = new Set(['mock-storage.example.com', 'example.com', 'www.example.com'])
  const localDirs = (inventory.localMedia || [])
    .map(entry => {
      const directory = entry.directory.replace(/\/+$/, '')
      const urlPrefix = directory === 'public' ? '/' : `/${directory.replace(/^public\//, '')}/`
      return { ...entry, directory, urlPrefix }
    })
    .sort((left, right) => right.urlPrefix.length - left.urlPrefix.length)

  const mediaSourcePath = repoPath('rebuild', 'src', 'shared', 'data', 'media.ts')
  const mediaSource = existsSync(mediaSourcePath) ? readText(mediaSourcePath) : ''
  const prefixMatch = mediaSource.match(/OFFLOADED_MEDIA_PREFIXES\s*=\s*\[([^\]]+)\]/)
  const offloadPrefixes = prefixMatch
    ? [...prefixMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1])
    : []

  return {
    inventory,
    buckets,
    syntheticHosts,
    siteHosts,
    localDirs,
    mediaSource,
    mediaSourcePath,
    offloadPrefixes,
  }
}

function mediaReferenceSources() {
  const references = []

  for (const directory of [MEDIA_REFERENCE_FILES.content, MEDIA_REFERENCE_FILES.fixtures]) {
    for (const filePath of listJsonFilesRecursive(directory)) {
      const json = readJsonFile(filePath)
      references.push(...findMediaReferences(relativeToRepo(filePath), json))
    }
  }

  // The manifest is itself a declared inventory: every entry must resolve too.
  const manifestPath = path.join(MEDIA_REFERENCE_FILES.content, 'MEDIA_MANIFEST.json')
  if (existsSync(manifestPath)) {
    const manifest = readJsonFile(manifestPath)
    for (const [index, entry] of (manifest.media || []).entries()) {
      if (typeof entry.path === 'string') {
        references.push({
          file: relativeToRepo(manifestPath),
          pointer: `$.media[${index}].path`,
          value: entry.path,
          manifestKind: entry.kind,
          manifestExists: entry.existsLocally,
          manifestSource: entry.source,
        })
      }
    }
  }

  // Synthetic local fixture rows (contracts/schema/fixtures.sql) reference media too.
  const fixturesSqlPath = path.join(contractSchemaDir, 'fixtures.sql')
  if (existsSync(fixturesSqlPath)) {
    const sql = readText(fixturesSqlPath)
    for (const match of sql.matchAll(
      /'(\/(?:images|media|video|background_audio|icons|captions)\/[^']*)'/g
    )) {
      references.push({
        file: relativeToRepo(fixturesSqlPath),
        pointer: 'sql-literal',
        value: match[1],
      })
    }
  }

  return references
}

function checkMediaCoverage() {
  const model = loadMediaModel()
  const localRoot = repoPath('public')
  const references = mediaReferenceSources()
  const byKind = {}
  const groups = new Map() // kind|identifier -> {kind, identifier, count, refs}

  for (const reference of references) {
    const classification = classifyMediaReference(reference, model)
    byKind[classification.kind] = (byKind[classification.kind] || 0) + 1
    const identifier =
      classification.kind === 'external-absolute' || classification.kind === 'supabase-storage'
        ? classification.hostname
        : classification.kind === 'synthetic-absolute' || classification.kind === 'dev-proxy'
          ? classification.kind
          : classification.pathname || reference.value
    const key = `${classification.kind}|${identifier}`
    let group = groups.get(key)
    if (!group) {
      group = { kind: classification.kind, identifier, count: 0, refs: [] }
      groups.set(key, group)
    }
    group.count += 1
    if (group.refs.length < 8) group.refs.push(`${reference.file}#${reference.pointer}`)
  }

  const bucketPatterns = model.buckets.flatMap(bucket =>
    bucket.patterns.map(pattern => ({ bucket, ...pattern }))
  )
  const unresolvedLocal = new Set()
  const unresolvedOffloaded = new Set()
  const externalHosts = {}
  let localResolvedReferences = 0

  for (const group of groups.values()) {
    const refs = group.refs

    if (group.kind === 'local') {
      const absolute = path.join(localRoot, group.identifier.replace(/^\/+/, ''))
      if (!existsSync(absolute)) {
        unresolvedLocal.add(group.identifier)
        const known = findKnown('media-missing-local-file', group.identifier)
        if (known) {
          knownFindings.push({
            kind: 'media-missing-local-file',
            identifier: group.identifier,
            risk: known.risk,
            reason: known.reason,
            count: group.count,
            refs,
          })
          if (!IGNORE_KNOWN) {
            mismatch(
              'media-missing-local-file',
              `referenced local media does not exist: ${group.identifier} (${group.count} reference(s); known ${known.risk})`,
              refs
            )
          }
        } else {
          mismatch(
            'media-missing-local-file',
            `referenced local media does not exist: ${group.identifier} (${group.count} reference(s))`,
            refs
          )
        }
      } else {
        localResolvedReferences += group.count
      }
      continue
    }

    if (group.kind === 'offloaded') {
      const candidate = group.identifier.replace(/^\/+/, '')
      const match = bucketPatterns.find(pattern => pattern.regex.test(candidate))
      if (!match) {
        unresolvedOffloaded.add(group.identifier)
        mismatch(
          'media-uncovered-cdn-path',
          `offloaded media path matches no bucket/pathPattern in contracts/media/INVENTORY.json: ${group.identifier} (${group.count} reference(s))`,
          refs
        )
      } else if (match.bucket.public !== true) {
        mismatch(
          'media-private-path-used-publicly',
          `offloaded path ${group.identifier} maps to non-public bucket "${match.bucket.name}"`,
          refs
        )
      }
      continue
    }

    if (group.kind === 'supabase-storage') {
      const declaresStorage = model.buckets.some(bucket =>
        /supabase storage/i.test(String(bucket.host))
      )
      if (!declaresStorage) {
        mismatch(
          'media-undeclared-storage-host',
          `absolute Supabase Storage URL referenced but INVENTORY.json declares no Supabase Storage bucket (${group.identifier})`,
          refs
        )
      }
      continue
    }

    if (group.kind === 'synthetic-absolute' || group.kind === 'dev-proxy') continue

    if (group.kind === 'external-absolute') {
      externalHosts[group.identifier] = group.count
      mismatch(
        'media-uncovered-external-host',
        `absolute media URL host is not covered by the media contract: ${group.identifier} (${group.count} reference(s))`,
        refs
      )
      continue
    }

    if (group.kind === 'malformed-absolute') {
      mismatch(
        'media-malformed-absolute',
        `malformed absolute media URL referenced (${group.count} reference(s))`,
        refs
      )
      continue
    }

    mismatch(
      'media-uncovered-relative-path',
      `root-relative media path is neither a local public/ path nor an offloaded CDN prefix: ${group.identifier}`,
      refs
    )
  }

  // Local media inventory must match the filesystem (files + bytes + git tracking).
  for (const entry of model.localDirs) {
    const absolute = path.join(repoPath(), entry.directory)
    const stats = statMediaDirectory(absolute, { recursive: entry.directory !== 'public' })
    if (stats.missing) {
      mismatch(
        'media-inventory-missing-directory',
        `INVENTORY.json localMedia directory is missing: ${entry.directory}`,
        ['contracts/media/INVENTORY.json']
      )
      continue
    }
    if (stats.files !== entry.files || stats.bytes !== entry.bytes) {
      mismatch(
        'media-inventory-stale',
        `INVENTORY.json localMedia drift for ${entry.directory}: declared ${entry.files} files / ${entry.bytes} B, measured ${stats.files} files / ${stats.bytes} B`,
        ['contracts/media/INVENTORY.json', entry.directory]
      )
    }
    try {
      const tracked = execFileSync('git', ['ls-files', '--', entry.directory], {
        cwd: repoPath(),
        encoding: 'utf8',
      })
        .split(/\r?\n/)
        .filter(Boolean).length
      if (entry.gitTracked && tracked === 0) {
        mismatch(
          'media-inventory-git-flag',
          `INVENTORY.json claims ${entry.directory} is git-tracked but git lists no tracked files`,
          ['contracts/media/INVENTORY.json']
        )
      }
      if (!entry.gitTracked && tracked > 0) {
        mismatch(
          'media-inventory-git-flag',
          `INVENTORY.json claims ${entry.directory} is gitignored but git tracks ${tracked} files`,
          ['contracts/media/INVENTORY.json']
        )
      }
    } catch {
      warning(
        'media-git-check',
        `could not run git ls-files for ${entry.directory} (read-only check skipped)`
      )
    }
  }

  // Offload prefix contract: media.ts must still declare exactly the frozen
  // prefixes, and every prefix must be covered by the public CDN declarations.
  const expectedPrefixes = ['/video/', '/background_audio/', '/media/']
  if (model.offloadPrefixes.length > 0) {
    const missingPrefixes = expectedPrefixes.filter(
      prefix => !model.offloadPrefixes.includes(prefix)
    )
    const extraPrefixes = model.offloadPrefixes.filter(prefix => !expectedPrefixes.includes(prefix))
    if (missingPrefixes.length > 0 || extraPrefixes.length > 0) {
      mismatch(
        'media-offload-prefix-drift',
        `rebuild/src/shared/data/media.ts offload prefixes drifted (missing: ${missingPrefixes.join(', ') || 'none'}; extra: ${extraPrefixes.join(', ') || 'none'})`,
        [relativeToRepo(model.mediaSourcePath)]
      )
    }
  } else {
    warning(
      'media-offload-prefix-unknown',
      'could not read OFFLOADED_MEDIA_PREFIXES from rebuild/src/shared/data/media.ts (informational)'
    )
  }
  for (const prefix of expectedPrefixes) {
    const covered = model.buckets.some(bucket =>
      bucket.patterns.some(pattern => pattern.regex.test(`${prefix.replace(/^\/+/, '')}x`))
    )
    if (!covered) {
      mismatch(
        'media-offload-prefix-uncovered',
        `offload prefix ${prefix} is not covered by any pathPattern in contracts/media/INVENTORY.json`,
        ['contracts/media/INVENTORY.json']
      )
    }
  }

  // Delivery contract: the app CSP must allow the media host (public/_headers).
  const headersPath = repoPath('public', '_headers')
  if (existsSync(headersPath)) {
    const headers = readText(headersPath)
    for (const requiredHost of ['media.wedding.theporadas.com', '*.r2.dev']) {
      if (!headers.includes(requiredHost)) {
        mismatch(
          'media-csp-missing-host',
          `public/_headers CSP no longer allows ${requiredHost} (media/CONTRACT.md §4)`,
          ['public/_headers', 'contracts/media/CONTRACT.md']
        )
      }
    }
  } else {
    warning('media-headers-missing', 'public/_headers is missing (informational)')
  }

  const manifestCount = references.filter(reference => reference.manifestKind !== undefined).length
  const distinctPaths = new Set(
    references.map(reference => normalizeUrlPath(reference.value) || reference.value)
  )

  return {
    counts: {
      buckets: model.buckets.length,
      localDirs: model.localDirs.length,
      manifestEntries: manifestCount,
      references: references.length,
      distinctPaths: distinctPaths.size,
      byKind,
      localResolved: localResolvedReferences,
      unresolvedLocal: unresolvedLocal.size,
      unresolvedOffloaded: unresolvedOffloaded.size,
      externalHosts,
    },
    byKind,
  }
}
// ────────────────────────────────────────────────────────────────────────────
// run
// ────────────────────────────────────────────────────────────────────────────

function main() {
  const migrations = loadMigrations()
  const expectedSchema = replayMigrations(migrations)
  const actualSchema = parseSchemaDump()
  const schemaCounts = compareSchema(
    { ...expectedSchema, migrations: migrations.length },
    actualSchema
  )
  const media = checkMediaCoverage()

  const result = {
    ok: mismatches.length === 0,
    readOnly: true,
    generatedFrom: {
      migrations: 'supabase/migrations/*.sql',
      schema: 'contracts/schema/schema.sql',
      storage: 'contracts/schema/storage.sql',
      mediaInventory: 'contracts/media/INVENTORY.json',
      mediaContract: 'contracts/media/CONTRACT.md',
    },
    counts: {
      migrations: migrations.length,
      schema: schemaCounts,
      media: media.counts,
      destructiveMigrationStatements: expectedSchema.destructive.length,
      supersededSchemaDrops: expectedSchema.schemaDrops.length,
    },
    mismatches,
    warnings,
    knownFindings,
    migrationFindings: {
      destructiveStatements: expectedSchema.destructive,
      schemaDrops: expectedSchema.schemaDrops,
    },
  }

  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = result.ok ? 0 : 1
    return
  }

  step('Schema contract — migrations vs committed contract dumps')
  info(`migrations replayed: ${migrations.length}`)
  ok(`tables: ${schemaCounts.tables.matched}/${schemaCounts.tables.expected} matched`)
  ok(
    `columns: ${schemaCounts.columns.matched}/${schemaCounts.columns.expected} matched (contract dump has ${schemaCounts.columns.contract})`
  )
  ok(
    `RLS policies: ${schemaCounts.policies.matched}/${schemaCounts.policies.expected} matched (public ${schemaCounts.policies.public}, storage ${schemaCounts.policies.storage})`
  )
  ok(`RPCs: ${schemaCounts.functions.matched}/${schemaCounts.functions.expected} matched`)
  info(`triggers: ${schemaCounts.triggers.matched}/${schemaCounts.triggers.expected} matched`)

  step('Media inventory coverage — contracts/content + fixtures vs contracts/media/INVENTORY.json')
  info(`buckets: ${media.counts.buckets}; local media dirs: ${media.counts.localDirs}`)
  info(
    `references: ${media.counts.references} (${media.counts.distinctPaths} distinct); kinds: ${Object.entries(
      media.counts.byKind
    )
      .map(([kind, count]) => `${kind}=${count}`)
      .join(', ')}`
  )
  info(
    `manifest entries checked: ${media.counts.manifestEntries}; resolved local refs: ${media.counts.localResolved}`
  )
  info(
    `destructive statements found in migration history: ${result.counts.destructiveMigrationStatements}`
  )

  for (const entry of mismatches.slice(0, 40)) {
    fail(
      `[${entry.kind}] ${entry.detail}${entry.refs.length > 0 ? ` (${entry.refs.join(', ')})` : ''}`
    )
  }
  if (mismatches.length > 40)
    fail(`... ${mismatches.length - 40} more mismatch(es); use --json for the full list`)

  if (knownFindings.length > 0) {
    step('Known findings (documented defects, owner-visible)')
    for (const entry of knownFindings) {
      warn(
        `[${entry.risk}] ${entry.detail ?? entry.identifier}: ${entry.reason} (${entry.count} reference(s))`
      )
    }
  }

  if (warnings.length > 0) {
    step('Warnings')
    for (const entry of warnings.slice(0, 20)) warn(`[${entry.kind}] ${entry.detail}`)
    if (warnings.length > 20)
      warn(`... ${warnings.length - 20} more warning(s); use --json for the full list`)
  }

  step('Data contract')
  if (mismatches.length === 0) {
    summary('RESULT', { mismatches: 0, warnings: warnings.length, migrations: migrations.length })
    ok('data + media contract matches the frozen migration chain (read-only check)')
    process.exitCode = 0
  } else {
    summary('RESULT', {
      mismatches: mismatches.length,
      warnings: warnings.length,
      migrations: migrations.length,
    })
    fail('data + media contract mismatch — see the entries above/file references')
    process.exitCode = 1
  }
}

try {
  main()
} catch (error) {
  fail(
    `check-data harness error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
  )
  process.exitCode = 2
}
