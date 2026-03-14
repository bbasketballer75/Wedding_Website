import fs from 'node:fs/promises'
import path from 'node:path'
import { baseName, readJson, toPosix, writeJson, writeMarkdown } from './photo-batch-utils.mjs'

const root = process.argv[2]
const workingRoot = process.argv[3]
const inventoryPathArg = process.argv[4]
const analysisPathArg = process.argv[5]

if (!root || !workingRoot) {
  console.error('Usage: node scripts/organize-photo-batch.mjs <source-root> <working-root> [inventory-json] [analysis-json]')
  process.exit(1)
}

function destinationFor(absoluteWorkingRoot, record, livePhotoStillBases, livePhotoClipBases, duplicateRelativePaths) {
  if (duplicateRelativePaths.has(record.relativePath)) {
    return path.join(absoluteWorkingRoot, 'organized', 'Review', 'Exact Duplicates')
  }

  if (record.topLevelFolder === 'Mr. and Mrs. Porada - MikaylaByersPhotography') {
    return path.join(absoluteWorkingRoot, 'organized', 'Professional', record.collection, 'Photos')
  }

  if (record.topLevelFolder === 'Bachelor+ette') {
    return path.join(
      absoluteWorkingRoot,
      'organized',
      'Bach+ette',
      record.kind === 'video' ? 'Videos' : 'Photos',
    )
  }

  if (record.topLevelFolder === 'Guest-Shared Wedding Gallery') {
    const key = baseName(record.filename)
    if (record.kind === 'video' && livePhotoClipBases.has(key)) {
      return path.join(absoluteWorkingRoot, 'organized', 'Guest Uploads', 'Wedding Day', 'Live Photos', 'Clips')
    }
    if (record.kind === 'image' && livePhotoStillBases.has(key)) {
      return path.join(absoluteWorkingRoot, 'organized', 'Guest Uploads', 'Wedding Day', 'Live Photos', 'Stills')
    }
    return path.join(
      absoluteWorkingRoot,
      'organized',
      'Guest Uploads',
      record.collection,
      record.kind === 'video' ? 'Standalone Videos' : 'Stills',
    )
  }

  return path.join(absoluteWorkingRoot, 'organized', 'Unsorted')
}

async function copyRecord(sourceRoot, record, destinationRoot) {
  const sourcePath = path.join(sourceRoot, ...record.relativePath.split('/'))
  const destinationPath = path.join(destinationRoot, record.filename)
  await fs.mkdir(destinationRoot, { recursive: true })
  await fs.copyFile(sourcePath, destinationPath)
  return destinationPath
}

async function main() {
  const absoluteRoot = path.resolve(root)
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const inventoryPath = inventoryPathArg
    ? path.resolve(inventoryPathArg)
    : path.join(absoluteWorkingRoot, 'catalog', 'wedding-master-inventory.enriched.json')
  const analysisPath = analysisPathArg
    ? path.resolve(analysisPathArg)
    : path.join(absoluteWorkingRoot, 'catalog', 'wedding-master-analysis.json')

  const inventory = await readJson(inventoryPath)
  const analysis = await readJson(analysisPath)

  const livePhotoClipBases = new Set(
    (analysis.livePhotoGroups ?? []).map((group) => baseName(path.basename(group.clip.relativePath))),
  )

  const livePhotoStillBases = new Set()
  for (const group of analysis.livePhotoGroups ?? []) {
    for (const still of group.stills ?? []) {
      livePhotoStillBases.add(baseName(path.basename(still.relativePath)))
    }
  }

  const duplicateRelativePaths = new Set(
    (analysis.exactDuplicateGroups ?? []).flatMap((group) => group.files.slice(1)),
  )

  const manifest = []
  for (const record of inventory) {
    const destinationRoot = destinationFor(
      absoluteWorkingRoot,
      record,
      livePhotoStillBases,
      livePhotoClipBases,
      duplicateRelativePaths,
    )
    const destinationPath = await copyRecord(absoluteRoot, record, destinationRoot)
    manifest.push({
      id: record.id,
      relativePath: record.relativePath,
      destination: destinationPath,
      destinationRelativePath: toPosix(path.relative(path.join(absoluteWorkingRoot, 'organized'), destinationPath)),
      topLevelFolder: record.topLevelFolder,
      kind: record.kind,
      source: record.source,
      collection: record.collection,
      storyLaneSuggestion: record.storyLaneSuggestion,
      duplicateGroupId: record.duplicateGroupId,
      similarGroupId: record.similarGroupId,
      livePhotoGroupId: record.livePhotoGroupId,
      coverCandidateRank: record.coverCandidateRank,
    })
  }

  const manifestPath = path.join(absoluteWorkingRoot, 'organized', 'organization-manifest.json')
  const summaryPath = path.join(absoluteWorkingRoot, 'organized', 'organization-summary.md')
  await writeJson(manifestPath, manifest)

  const summaryByDestination = new Map()
  for (const item of manifest) {
    const destinationRoot = item.destinationRelativePath.replace(/\/[^/]+$/, '')
    summaryByDestination.set(destinationRoot, (summaryByDestination.get(destinationRoot) ?? 0) + 1)
  }

  const lines = [
    '# First-Pass Organization Summary',
    '',
    `Source root: \`${absoluteRoot}\``,
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Files copied: **${manifest.length}**`,
    `Exact duplicates isolated for review: **${duplicateRelativePaths.size}**`,
    '',
  ]

  for (const [destinationRoot, count] of [...summaryByDestination.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push(`- \`${destinationRoot}\`: ${count}`)
  }

  lines.push('')
  lines.push('## Notes')
  lines.push('- Originals were not modified.')
  lines.push('- Later files in an exact-duplicate group were copied into `organized/Review/Exact Duplicates` for manual review.')
  lines.push('- Guest live photos were identified by short clips plus matching still-image base names.')

  await writeMarkdown(summaryPath, lines)

  console.log(`Wrote manifest to ${manifestPath}`)
  console.log(`Wrote summary to ${summaryPath}`)
}

await main()
