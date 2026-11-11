/**
 * Emit `rebuild/src/features/gallery/intrinsic-ratios.ts` from the real media
 * files.
 *
 * The frozen gallery does NOT lay tiles out from the `aspectRatio` metadata: the
 * virtualized row is a flex row where each tile's width comes from the image's
 * intrinsic ratio at its 270px image height (e.g. `PoradaProposal-310.webp` is
 * portrait on disk while its metadata says 1.5). Matching that is required for
 * pixel parity, so the ratios are measured from the files once and committed.
 *
 * Usage:
 *   node tools/extract-content/emit-gallery-intrinsic-ratios.mjs          # write
 *   node tools/extract-content/emit-gallery-intrinsic-ratios.mjs --check  # verify
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const curatedPath = path.join(repoRoot, 'contracts', 'content', 'curated-photos.json')
const liveFixturePath = path.join(repoRoot, 'contracts', 'fixtures', 'photos.json')
const targetPath = path.join(
  repoRoot,
  'rebuild',
  'src',
  'features',
  'gallery',
  'intrinsic-ratios.ts'
)

const curated = JSON.parse(readFileSync(curatedPath, 'utf8'))
const live = JSON.parse(readFileSync(liveFixturePath, 'utf8'))

const paths = new Set()
for (const row of [...curated, ...(Array.isArray(live) ? live : [])]) {
  for (const value of [row.url, row.thumbnail]) {
    if (typeof value === 'string' && value.startsWith('/images/')) paths.add(value)
  }
}

const entries = []
for (const assetPath of [...paths].sort()) {
  const file = path.join(repoRoot, 'public', assetPath)
  let metadata
  try {
    metadata = await sharp(file).metadata()
  } catch (error) {
    throw new Error(`Cannot read image dimensions for ${assetPath}: ${error.message}`)
  }
  if (!metadata.width || !metadata.height) {
    throw new Error(`Image has no dimensions: ${assetPath}`)
  }
  entries.push([assetPath, Number((metadata.width / metadata.height).toFixed(4))])
}

const body = entries.map(([asset, ratio]) => `  ${JSON.stringify(asset)}: ${ratio},`).join('\n')

const file = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source: measured pixel dimensions of the gallery media under public/.
 * Regenerate: node tools/extract-content/emit-gallery-intrinsic-ratios.mjs
 * Check:      node tools/extract-content/emit-gallery-intrinsic-ratios.mjs --check
 *
 * The frozen gallery sizes tiles from the image's intrinsic ratio (the browser
 * resolves flex-tile width from the intrinsic ratio at the fixed 270px image
 * height), not from the curated \`aspectRatio\` metadata.
 */
export const INTRINSIC_RATIOS: Readonly<Record<string, number>> = {
${body}
}
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
      `STALE: ${path.relative(repoRoot, targetPath)} differs from measured media ratios`
    )
    process.exit(1)
  }
  console.log(`OK: ${path.relative(repoRoot, targetPath)} is in sync (${entries.length} images)`)
} else {
  writeFileSync(targetPath, file)
  console.log(`Wrote ${path.relative(repoRoot, targetPath)} (${entries.length} images)`)
}
