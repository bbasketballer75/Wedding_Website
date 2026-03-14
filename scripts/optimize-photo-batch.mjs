import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import {
  IMAGE_EXTENSIONS,
  readJson,
  toPosix,
  walk,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const execFileAsync = promisify(execFile)

const organizedRoot = process.argv[2]
const optimizedRoot = process.argv[3]
const organizationManifestArg = process.argv[4]

if (!organizedRoot || !optimizedRoot) {
  console.error('Usage: node scripts/optimize-photo-batch.mjs <organized-root> <optimized-root> [organization-manifest]')
  process.exit(1)
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function optimizeImage(sourcePath, relativePath, optimizedRootPath, manifestLookup) {
  const parsed = path.parse(relativePath)
  const baseOutput = path.join(optimizedRootPath, parsed.dir, parsed.name)
  const displayPath = `${baseOutput}.webp`
  const thumbPath = path.join(optimizedRootPath, '_thumbs', parsed.dir, `${parsed.name}.webp`)

  const image = sharp(sourcePath, { failOn: 'none' }).rotate()
  let metadata
  try {
    metadata = await image.metadata()
  } catch {
    metadata = { width: 0, height: 0, size: null }
  }

  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const displayLongEdge = width >= height ? 2600 : 2200
  const thumbLongEdge = width >= height ? 720 : 640

  await ensureDir(displayPath)
  await ensureDir(thumbPath)

  try {
    await image
      .clone()
      .resize({
        width: width >= height ? displayLongEdge : null,
        height: height > width ? displayLongEdge : null,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 5 })
      .toFile(displayPath)

    await image
      .clone()
      .resize({
        width: width >= height ? thumbLongEdge : null,
        height: height > width ? thumbLongEdge : null,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 72, effort: 4 })
      .toFile(thumbPath)
  } catch {
    await execFileAsync('magick', [
      sourcePath,
      '-auto-orient',
      '-resize',
      `${displayLongEdge}x${displayLongEdge}>`,
      '-quality',
      '82',
      displayPath,
    ], { maxBuffer: 1024 * 1024 * 32 })

    await execFileAsync('magick', [
      sourcePath,
      '-auto-orient',
      '-resize',
      `${thumbLongEdge}x${thumbLongEdge}>`,
      '-quality',
      '72',
      thumbPath,
    ], { maxBuffer: 1024 * 1024 * 32 })
  }

  const displayStat = await fs.stat(displayPath)
  const thumbStat = await fs.stat(thumbPath)
  const sourceManifestEntry = manifestLookup.get(toPosix(relativePath))

  return {
    type: 'image',
    relativePath: toPosix(relativePath),
    sourceRelativePath: sourceManifestEntry?.relativePath ?? null,
    displayPath,
    displayRelativePath: toPosix(path.relative(optimizedRootPath, displayPath)),
    thumbPath,
    thumbRelativePath: toPosix(path.relative(optimizedRootPath, thumbPath)),
    originalBytes: metadata.size ?? null,
    displayBytes: displayStat.size,
    thumbBytes: thumbStat.size,
    width,
    height,
    collection: sourceManifestEntry?.collection ?? null,
    storyLaneSuggestion: sourceManifestEntry?.storyLaneSuggestion ?? null,
    duplicateGroupId: sourceManifestEntry?.duplicateGroupId ?? null,
    similarGroupId: sourceManifestEntry?.similarGroupId ?? null,
    livePhotoGroupId: sourceManifestEntry?.livePhotoGroupId ?? null,
    coverCandidateRank: sourceManifestEntry?.coverCandidateRank ?? null,
  }
}

async function copyOther(sourcePath, relativePath, optimizedRootPath, manifestLookup) {
  const destinationPath = path.join(optimizedRootPath, relativePath)
  await ensureDir(destinationPath)
  await fs.copyFile(sourcePath, destinationPath)
  const stat = await fs.stat(destinationPath)
  const sourceManifestEntry = manifestLookup.get(toPosix(relativePath))

  return {
    type: 'passthrough',
    relativePath: toPosix(relativePath),
    sourceRelativePath: sourceManifestEntry?.relativePath ?? null,
    outputPath: destinationPath,
    outputRelativePath: toPosix(path.relative(optimizedRootPath, destinationPath)),
    sizeBytes: stat.size,
    collection: sourceManifestEntry?.collection ?? null,
    storyLaneSuggestion: sourceManifestEntry?.storyLaneSuggestion ?? null,
  }
}

async function main() {
  const absoluteOrganizedRoot = path.resolve(organizedRoot)
  const absoluteOptimizedRoot = path.resolve(optimizedRoot)
  const organizationManifestPath = organizationManifestArg
    ? path.resolve(organizationManifestArg)
    : path.join(path.dirname(absoluteOrganizedRoot), 'organized', 'organization-manifest.json')

  const manifestLookup = new Map()
  try {
    const organizationManifest = await readJson(organizationManifestPath)
    for (const entry of organizationManifest) {
      manifestLookup.set(entry.destinationRelativePath, entry)
    }
  } catch {
    // Continue without source linkage if the organization manifest is missing.
  }

  const files = await walk(absoluteOrganizedRoot)
  const manifest = []

  for (const sourcePath of files) {
    const relativePath = path.relative(absoluteOrganizedRoot, sourcePath)
    const extension = path.extname(sourcePath).toLowerCase()
    if (IMAGE_EXTENSIONS.has(extension)) {
      manifest.push(await optimizeImage(sourcePath, relativePath, absoluteOptimizedRoot, manifestLookup))
    } else {
      manifest.push(await copyOther(sourcePath, relativePath, absoluteOptimizedRoot, manifestLookup))
    }
  }

  const manifestPath = path.join(absoluteOptimizedRoot, 'optimized-manifest.json')
  const summaryPath = path.join(absoluteOptimizedRoot, 'optimized-summary.md')
  await writeJson(manifestPath, manifest)

  const imageCount = manifest.filter((item) => item.type === 'image').length
  const passthroughCount = manifest.filter((item) => item.type === 'passthrough').length
  const totalDisplayBytes = manifest
    .filter((item) => item.type === 'image')
    .reduce((sum, item) => sum + item.displayBytes + item.thumbBytes, 0)
  const totalPassthroughBytes = manifest
    .filter((item) => item.type === 'passthrough')
    .reduce((sum, item) => sum + item.sizeBytes, 0)

  const summary = [
    '# Optimized Batch Summary',
    '',
    `Organized root: \`${absoluteOrganizedRoot}\``,
    `Optimized root: \`${absoluteOptimizedRoot}\``,
    '',
    `- Optimized images: **${imageCount}**`,
    `- Passthrough files: **${passthroughCount}**`,
    `- Optimized image payload: **${(totalDisplayBytes / (1024 * 1024 * 1024)).toFixed(2)} GB**`,
    `- Passthrough payload: **${(totalPassthroughBytes / (1024 * 1024 * 1024)).toFixed(2)} GB**`,
    '',
    '## Output rules',
    '- Images are converted to `.webp` display files plus smaller thumbnail `.webp` files.',
    '- Non-image files are copied through untouched for now.',
    '- Optimized outputs keep source links in the manifest for later import/export steps.',
  ]

  await writeMarkdown(summaryPath, summary)
  console.log(`Wrote optimized manifest to ${manifestPath}`)
  console.log(`Wrote summary to ${summaryPath}`)
}

await main()
