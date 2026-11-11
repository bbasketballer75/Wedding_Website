#!/usr/bin/env node
/**
 * tools/cutover/lib.mjs — shared, READ-ONLY helpers for the Wave 9 cutover checkers.
 *
 * These helpers only read from disk: there is no `writeFile`, `mkdir`, `rm`,
 * exec of mutating commands, or network call anywhere in tools/cutover/**. The
 * checkers are safe to run against the repo at any time (CI, checkpoint, pre-
 * cutover rehearsal) and never touch Supabase, Netlify, R2, or `supabase/`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { repoPath } from '../lib/paths.mjs'
import { sha256 } from '../lib/fs.mjs'

export { repoPath, sha256 }

export const migrationsDir = repoPath('supabase', 'migrations')
export const contractSchemaDir = repoPath('contracts', 'schema')
export const contractMediaDir = repoPath('contracts', 'media')

/** Media extensions the contracts are allowed to reference. */
export const MEDIA_EXTENSIONS = new Set([
  '.webp',
  '.jpg',
  '.jpeg',
  '.png',
  '.avif',
  '.gif',
  '.svg',
  '.ico',
  '.mp4',
  '.webm',
  '.mov',
  '.mp3',
  '.flac',
  '.wav',
  '.vtt',
  '.woff',
  '.woff2',
])

/** Read a UTF-8 text file. */
export function readText(filePath) {
  return readFileSync(filePath, 'utf8')
}

/** Read + parse a JSON file. */
export function readJsonFile(filePath) {
  return JSON.parse(readText(filePath))
}

/** Repo-relative path with forward slashes (stable in reports on Windows). */
export function relativeToRepo(absolutePath) {
  return path.relative(repoPath(), absolutePath).replace(/\\/g, '/')
}

/**
 * Load every migration in filename order with its 14-digit version, label,
 * SHA-256 checksum and lines. Migrations are the frozen legacy chain: read-only.
 */
export function loadMigrations() {
  const names = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort()

  return names.map(name => {
    const filePath = path.join(migrationsDir, name)
    const text = readText(filePath)
    return {
      name,
      file: relativeToRepo(filePath),
      absolutePath: filePath,
      version: name.slice(0, 14),
      label: name.slice(15, -4),
      sha256: sha256(text),
      text,
      lines: text.split(/\r?\n/),
    }
  })
}

/** Trim + collapse whitespace. */
export function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Strip SQL identifier quotes (`"`, backticks) from a token. */
export function unquote(value) {
  return value.replace(/"/g, '').replace(/`/g, '').trim()
}

/**
 * Normalise a table reference to `schema.table` (default schema: public).
 * Accepts `photos`, `public.photos`, `"public"."photos"`, `storage.objects`.
 */
export function normalizeTableRef(rawRef) {
  const cleaned = unquote(rawRef).toLowerCase()
  const parts = cleaned.split('.').filter(Boolean)
  if (parts.length === 0) return 'public.unknown'
  if (parts.length === 1) return `public.${parts[0]}`
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
}

/** Convert an inventory glob (`/video/**`, `guest-uploads/photos/**`, `**`) to a RegExp. */
export function globToRegExp(pattern) {
  const normalized = unquote(pattern).replace(/^\/+/, '')
  let escaped = ''
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (char === '*' && normalized[index + 1] === '*') {
      escaped += '.*'
      index += 1
    } else if (char === '*') {
      escaped += '[^/]*'
    } else if ('\\^$+?.()|{}[]'.includes(char)) {
      escaped += `\\${char}`
    } else {
      escaped += char
    }
  }
  return new RegExp(`^${escaped}$`)
}

/** Visit every leaf of a JSON value with a JSON-pointer-ish path. */
export function walkJson(value, visit, pointer = '$') {
  visit(value, pointer)
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkJson(entry, visit, `${pointer}[${index}]`))
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      walkJson(entry, visit, `${pointer}.${key}`)
    }
  }
}

/** True when a string looks like a media path (URL path or absolute URL). */
export function looksLikeMediaPath(value) {
  if (typeof value !== 'string' || value.length < 2) return false
  if (!value.startsWith('/') && !/^https?:\/\//.test(value)) return false
  const pathname = value.startsWith('http') ? safeUrlPath(value) : value.split(/[?#]/)[0]
  if (!pathname) return false
  const extension = path.extname(pathname).toLowerCase()
  return MEDIA_EXTENSIONS.has(extension)
}

/** Best-effort URL pathname; returns null for malformed URLs. */
export function safeUrlPath(value) {
  try {
    return new URL(value).pathname
  } catch {
    return null
  }
}

/**
 * Collect every media-looking string in a JSON document.
 * @returns {{file: string, pointer: string, value: string}[]}
 */
export function findMediaReferences(relativeFile, json) {
  const references = []
  walkJson(json, (value, pointer) => {
    if (looksLikeMediaPath(value)) references.push({ file: relativeFile, pointer, value })
  })
  return references
}

/** Recursively count files + bytes under a directory (metadata only; no content reads). */
export function statMediaDirectory(absoluteDir, { recursive = true } = {}) {
  let files = 0
  let bytes = 0
  const stack = [absoluteDir]

  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return { files: 0, bytes: 0, missing: true }
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (recursive) stack.push(fullPath)
      } else if (entry.isFile()) {
        files += 1
        try {
          bytes += statSync(fullPath).size
        } catch {
          /* unreadable file: count it, size unknown */
        }
      }
    }
  }

  return { files, bytes, missing: false }
}

/** Deterministic serialisation used for stable JSON output. */
export function sortByKey(entries) {
  return [...entries].sort((left, right) => String(left).localeCompare(String(right)))
}
