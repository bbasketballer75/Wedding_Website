/**
 * Emit `rebuild/src/features/gallery/curated-photos.ts` from the contract copy.
 *
 * The frozen gallery ships 35 curated rows as first-class content. The rebuild
 * must use the SAME ids, urls, captions, ratios and ordering as the oracle, so
 * the list is generated from `contracts/content/curated-photos.json` instead of
 * being hand-maintained (hand-written fixtures drifted: wrong captions and
 * counts, which broke `/gallery` text parity).
 *
 * Usage:
 *   node tools/extract-content/emit-rebuild-gallery-fixtures.mjs          # write
 *   node tools/extract-content/emit-rebuild-gallery-fixtures.mjs --check  # verify
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const sourcePath = path.join(repoRoot, 'contracts', 'content', 'curated-photos.json')
const targetPath = path.join(repoRoot, 'rebuild', 'src', 'features', 'gallery', 'curated-photos.ts')

const rows = JSON.parse(readFileSync(sourcePath, 'utf8'))

if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error('contracts/content/curated-photos.json must be a non-empty array')
}

const toLiteral = row => {
  const photo = {
    id: row.id,
    url: row.url,
    thumbnail: row.thumbnail || row.url,
    downloadUrl: row.downloadUrl || row.url,
    caption: row.caption ?? undefined,
    album: row.album ?? undefined,
    category: row.category ?? undefined,
    likes: Number(row.likes ?? 0),
    aspectRatio: Number(row.aspectRatio ?? 1),
    time: row.time ?? undefined,
    location: row.location ?? undefined,
    photographer: row.photographer ?? undefined,
    date: row.date ?? undefined,
    createdAt: row.createdAt ?? undefined,
    faces: (row.faces ?? []).map(face => ({
      id: face.id ?? face.name,
      name: face.name,
      x: Number(face.x ?? 0),
      y: Number(face.y ?? 0),
      ...(face.box ? { box: { width: Number(face.box.width ?? 0) } } : {}),
    })),
    tags: row.tags ?? [],
    source: row.source === 'guest' ? 'guest' : 'professional',
    collection: row.collection,
    ...(row.albumSortOrder !== undefined ? { albumSortOrder: row.albumSortOrder } : {}),
  }

  return JSON.stringify(photo, null, 2)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n')
}

const body = rows.map(toLiteral).join(',\n')

const file = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source: contracts/content/curated-photos.json (frozen curated gallery copy).
 * Regenerate: node tools/extract-content/emit-rebuild-gallery-fixtures.mjs
 * Check:      node tools/extract-content/emit-rebuild-gallery-fixtures.mjs --check
 */
import type { GalleryPhoto } from './data'

export const CURATED_PHOTOS: GalleryPhoto[] = [
${body},
]
`

const check = process.argv.includes('--check')

if (check) {
  let current = ''
  try {
    current = readFileSync(targetPath, 'utf8')
  } catch {
    console.error(`MISSING: ${path.relative(repoRoot, targetPath)}`)
    process.exit(1)
  }
  if (current !== file) {
    console.error(
      `STALE: ${path.relative(repoRoot, targetPath)} differs from contracts/content/curated-photos.json`
    )
    process.exit(1)
  }
  console.log(`OK: ${path.relative(repoRoot, targetPath)} is in sync (${rows.length} curated rows)`)
} else {
  writeFileSync(targetPath, file)
  console.log(`Wrote ${path.relative(repoRoot, targetPath)} (${rows.length} curated rows)`)
}
