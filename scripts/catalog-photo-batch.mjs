import fs from 'node:fs/promises'
import path from 'node:path'
import {
  createStableId,
  createTopLevelSummary,
  fileHash,
  getImageMetadata,
  getKind,
  getVideoMetadata,
  inferCanonicalAlbum,
  inferSourceInfo,
  toPosix,
  walk,
  writeCsv,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const root = process.argv[2]
const outputDir = process.argv[3] ?? path.resolve(process.cwd(), 'photo_inventory')

if (!root) {
  console.error('Usage: node scripts/catalog-photo-batch.mjs <root-folder> [output-dir]')
  process.exit(1)
}

async function buildRecord(filePath, absoluteRoot) {
  const stats = await fs.stat(filePath)
  const relativePath = toPosix(path.relative(absoluteRoot, filePath))
  const topLevelFolder = relativePath.split('/')[0] ?? ''
  const extension = path.extname(filePath).toLowerCase()
  const kind = getKind(extension)
  const sourceInfo = inferSourceInfo(topLevelFolder)
  const canonicalAlbum = inferCanonicalAlbum(topLevelFolder, relativePath)
  const enriched =
    kind === 'image'
      ? await getImageMetadata(filePath, `${topLevelFolder} ${relativePath}`)
      : kind === 'video'
        ? await getVideoMetadata(filePath)
        : {
          width: null,
          height: null,
          orientation: 'unknown',
          format: null,
          captureDate: stats.mtime.toISOString(),
          captureDateSource: 'filesystem.mtime',
          latitude: null,
          longitude: null,
          cameraMake: null,
          cameraModel: null,
          lensModel: null,
          averageHash: null,
          sharpness: null,
          brightness: null,
          qualityScore: null,
          collection: sourceInfo.collection,
          storyLaneSuggestion: sourceInfo.storyLaneSuggestion,
          memoryTrailSuggestion: sourceInfo.memoryTrailSuggestion,
        }

  return {
    id: createStableId('media', relativePath, String(stats.size), stats.mtime.toISOString()),
    topLevelFolder,
    relativePath,
    filename: path.basename(filePath),
    extension,
    kind,
    source: sourceInfo.source,
    collection: canonicalAlbum ?? enriched.collection ?? sourceInfo.collection,
    storyLaneSuggestion: enriched.storyLaneSuggestion ?? sourceInfo.storyLaneSuggestion,
    memoryTrailSuggestion: enriched.memoryTrailSuggestion ?? sourceInfo.memoryTrailSuggestion,
    sizeBytes: stats.size,
    sizeMB: Number((stats.size / (1024 * 1024)).toFixed(2)),
    width: enriched.width,
    height: enriched.height,
    orientation: enriched.orientation,
    format: enriched.format,
    durationSeconds: enriched.durationSeconds ?? null,
    captureDate: enriched.captureDate,
    captureDateSource: enriched.captureDateSource,
    latitude: enriched.latitude,
    longitude: enriched.longitude,
    cameraMake: enriched.cameraMake,
    cameraModel: enriched.cameraModel,
    lensModel: enriched.lensModel,
    averageHash: enriched.averageHash,
    sharpness: enriched.sharpness,
    brightness: enriched.brightness,
    qualityScore: enriched.qualityScore,
    contentHash: await fileHash(filePath),
  }
}

async function main() {
  const absoluteRoot = path.resolve(root)
  const files = await walk(absoluteRoot)
  const records = []

  for (const filePath of files) {
    records.push(await buildRecord(filePath, absoluteRoot))
  }

  const inventoryPath = path.join(outputDir, 'wedding-master-inventory.json')
  const csvPath = path.join(outputDir, 'wedding-master-inventory.csv')
  const summaryPath = path.join(outputDir, 'wedding-master-summary.md')

  await writeJson(inventoryPath, records)
  await writeCsv(
    csvPath,
    records,
    [
      'id',
      'topLevelFolder',
      'relativePath',
      'filename',
      'kind',
      'source',
      'collection',
      'storyLaneSuggestion',
      'memoryTrailSuggestion',
      'sizeBytes',
      'width',
      'height',
      'orientation',
      'durationSeconds',
      'captureDate',
      'latitude',
      'longitude',
      'qualityScore',
      'contentHash',
    ],
  )

  const byFolder = createTopLevelSummary(records)
  const storyCounts = records.reduce((acc, record) => {
    const key = record.storyLaneSuggestion || 'review'
    acc.set(key, (acc.get(key) ?? 0) + 1)
    return acc
  }, new Map())

  const summaryLines = [
    '# Wedding Master Inventory',
    '',
    `Root: \`${absoluteRoot}\``,
    '',
    `Total files: **${records.length}**`,
    `Images: **${records.filter((record) => record.kind === 'image').length}**`,
    `Videos: **${records.filter((record) => record.kind === 'video').length}**`,
    '',
    '## Story-Lane Suggestions',
    '',
    ...[...storyCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([storyLane, count]) => `- ${storyLane}: ${count}`),
    '',
  ]

  for (const folder of byFolder) {
    summaryLines.push(`## ${folder.folder}`)
    summaryLines.push(`- Total files: ${folder.count}`)
    summaryLines.push(`- Total size: ${folder.totalGB} GB`)
    summaryLines.push(`- Images: ${folder.images}`)
    summaryLines.push(`- Videos: ${folder.videos}`)
    if (folder.images > 0) {
      summaryLines.push(
        `- Portrait / Landscape / Square: ${folder.portraits} / ${folder.landscapes} / ${folder.squares}`,
      )
    }
    summaryLines.push('')
  }

  await writeMarkdown(summaryPath, summaryLines)

  console.log(`Wrote inventory to ${inventoryPath}`)
  console.log(`Wrote CSV to ${csvPath}`)
  console.log(`Wrote summary to ${summaryPath}`)
}

await main()
