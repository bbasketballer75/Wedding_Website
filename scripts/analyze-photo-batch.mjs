import path from 'node:path'
import {
  buildBaseKey,
  buildMarkdownTable,
  createStableId,
  hammingDistance,
  readJson,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const root = process.argv[2]
const outputDir = process.argv[3]
const inventoryPathArg = process.argv[4]

if (!root || !outputDir) {
  console.error('Usage: node scripts/analyze-photo-batch.mjs <root-folder> <output-dir> [inventory-json]')
  process.exit(1)
}

function groupConnected(items, shouldConnect) {
  const groups = []
  const visited = new Set()

  for (let index = 0; index < items.length; index += 1) {
    if (visited.has(index)) continue

    const queue = [index]
    const members = []
    visited.add(index)

    while (queue.length > 0) {
      const currentIndex = queue.shift()
      const current = items[currentIndex]
      members.push(current)

      for (let candidateIndex = 0; candidateIndex < items.length; candidateIndex += 1) {
        if (visited.has(candidateIndex) || candidateIndex === currentIndex) continue
        if (!shouldConnect(current, items[candidateIndex])) continue
        visited.add(candidateIndex)
        queue.push(candidateIndex)
      }
    }

    groups.push(members)
  }

  return groups
}

function diffMinutes(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 60_000
}

function buildExactDuplicateGroups(inventory) {
  const groups = new Map()

  for (const record of inventory) {
    const current = groups.get(record.contentHash) ?? []
    current.push(record)
    groups.set(record.contentHash, current)
  }

  return [...groups.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([contentHash, records]) => ({
      duplicateGroupId: createStableId('dup', contentHash),
      contentHash,
      count: records.length,
      files: records
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
        .map((record) => record.relativePath),
    }))
    .sort((left, right) => right.count - left.count || left.files[0].localeCompare(right.files[0]))
}

function buildSimilarShotGroups(images) {
  const candidates = images.filter((record) => record.averageHash)
  const groups = groupConnected(candidates, (left, right) => {
    if (left.id === right.id) return false
    if (left.topLevelFolder !== right.topLevelFolder) return false
    if (left.orientation !== 'unknown' && right.orientation !== 'unknown' && left.orientation !== right.orientation) {
      return false
    }

    const hashDistance = hammingDistance(left.averageHash, right.averageHash)
    const captureGapMinutes = diffMinutes(left.captureDate, right.captureDate)
    return hashDistance <= 8 || (hashDistance <= 12 && captureGapMinutes <= 30)
  })

  return groups
    .filter((group) => group.length > 1)
    .map((group) => ({
      similarGroupId: createStableId('similar', ...group.map((record) => record.id).sort()),
      count: group.length,
      folder: group[0]?.topLevelFolder ?? '',
      averageQualityScore:
        Number(
          (
            group.reduce((sum, record) => sum + (record.qualityScore || 0), 0) /
            Math.max(group.length, 1)
          ).toFixed(2),
        ),
      files: group
        .sort((left, right) => (right.qualityScore || 0) - (left.qualityScore || 0))
        .map((record) => ({
          id: record.id,
          relativePath: record.relativePath,
          captureDate: record.captureDate,
          qualityScore: record.qualityScore,
        })),
    }))
    .sort((left, right) => right.count - left.count || right.averageQualityScore - left.averageQualityScore)
}

function buildLivePhotoGroups(images, videos) {
  const imagesByBase = new Map()
  for (const image of images) {
    const key = buildBaseKey(image)
    const current = imagesByBase.get(key) ?? []
    current.push(image)
    imagesByBase.set(key, current)
  }

  return videos
    .map((video) => {
      const imageMatches = imagesByBase.get(buildBaseKey(video)) ?? []
      const likelyShortClip = typeof video.durationSeconds === 'number' && video.durationSeconds <= 4.5
      if (!likelyShortClip && imageMatches.length === 0) return null

      return {
        livePhotoGroupId: createStableId('live-photo', video.id, ...imageMatches.map((image) => image.id)),
        folder: video.topLevelFolder,
        clip: {
          id: video.id,
          relativePath: video.relativePath,
          durationSeconds: video.durationSeconds,
        },
        stills: imageMatches.map((image) => ({
          id: image.id,
          relativePath: image.relativePath,
          qualityScore: image.qualityScore,
        })),
      }
    })
    .filter(Boolean)
    .sort((left, right) => (right.stills.length - left.stills.length) || (left.clip.relativePath.localeCompare(right.clip.relativePath)))
}

function buildCoverCandidates(images) {
  const buckets = new Map()

  for (const image of images) {
    const bucketKey = `${image.collection}::${image.storyLaneSuggestion || 'review'}`
    const current = buckets.get(bucketKey) ?? []
    current.push(image)
    buckets.set(bucketKey, current)
  }

  return [...buckets.entries()]
    .map(([bucketKey, records]) => ({
      bucketKey,
      collection: records[0]?.collection ?? 'Uncategorized',
      storyLaneSuggestion: records[0]?.storyLaneSuggestion ?? 'review',
      images: records
        .sort((left, right) => (right.qualityScore || 0) - (left.qualityScore || 0))
        .slice(0, 8)
        .map((record, index) => ({
          rank: index + 1,
          id: record.id,
          relativePath: record.relativePath,
          qualityScore: record.qualityScore,
          captureDate: record.captureDate,
        })),
    }))
    .sort((left, right) => left.bucketKey.localeCompare(right.bucketKey))
}

function buildStoryGroups(inventory) {
  const groups = new Map()

  for (const record of inventory) {
    const dateKey = record.captureDate ? record.captureDate.slice(0, 10) : 'undated'
    const key = `${record.collection}::${record.storyLaneSuggestion || 'review'}::${dateKey}`
    const current = groups.get(key) ?? []
    current.push(record)
    groups.set(key, current)
  }

  return [...groups.entries()]
    .map(([groupKey, records]) => ({
      storyGroupId: createStableId('story', groupKey),
      collection: records[0]?.collection ?? 'Uncategorized',
      storyLaneSuggestion: records[0]?.storyLaneSuggestion ?? 'review',
      captureDate: records[0]?.captureDate?.slice(0, 10) ?? null,
      itemCount: records.length,
      imageCount: records.filter((record) => record.kind === 'image').length,
      videoCount: records.filter((record) => record.kind === 'video').length,
      representativeFiles: records
        .sort((left, right) => (right.qualityScore || 0) - (left.qualityScore || 0))
        .slice(0, 5)
        .map((record) => record.relativePath),
    }))
    .sort((left, right) => {
      const leftDate = left.captureDate || '9999-99-99'
      const rightDate = right.captureDate || '9999-99-99'
      return leftDate.localeCompare(rightDate) || left.collection.localeCompare(right.collection)
    })
}

function attachMemberships(inventory, report) {
  const duplicateMap = new Map()
  const similarMap = new Map()
  const livePhotoMap = new Map()
  const coverMap = new Map()

  for (const group of report.exactDuplicateGroups) {
    for (const file of group.files) duplicateMap.set(file, group.duplicateGroupId)
  }

  for (const group of report.similarShotGroups) {
    for (const file of group.files) similarMap.set(file.relativePath, group.similarGroupId)
  }

  for (const group of report.livePhotoGroups) {
    livePhotoMap.set(group.clip.relativePath, group.livePhotoGroupId)
    for (const still of group.stills) livePhotoMap.set(still.relativePath, group.livePhotoGroupId)
  }

  for (const bucket of report.coverCandidates) {
    for (const candidate of bucket.images) coverMap.set(candidate.relativePath, candidate.rank)
  }

  return inventory.map((record) => ({
    ...record,
    duplicateGroupId: duplicateMap.get(record.relativePath) ?? null,
    similarGroupId: similarMap.get(record.relativePath) ?? null,
    livePhotoGroupId: livePhotoMap.get(record.relativePath) ?? null,
    coverCandidateRank: coverMap.get(record.relativePath) ?? null,
  }))
}

async function main() {
  const absoluteRoot = path.resolve(root)
  const absoluteOutputDir = path.resolve(outputDir)
  const inventoryPath = inventoryPathArg
    ? path.resolve(inventoryPathArg)
    : path.join(absoluteOutputDir, 'wedding-master-inventory.json')

  const inventory = await readJson(inventoryPath)
  const imageRecords = inventory.filter((record) => record.kind === 'image')
  const videoRecords = inventory.filter((record) => record.kind === 'video')

  const report = {
    generatedAt: new Date().toISOString(),
    root: absoluteRoot,
    exactDuplicateGroups: buildExactDuplicateGroups(inventory),
    similarShotGroups: buildSimilarShotGroups(imageRecords),
    livePhotoGroups: buildLivePhotoGroups(imageRecords, videoRecords),
    coverCandidates: buildCoverCandidates(imageRecords),
    storyGroups: buildStoryGroups(inventory),
  }

  const enrichedInventory = attachMemberships(inventory, report)
  const analysisPath = path.join(absoluteOutputDir, 'wedding-master-analysis.json')
  const enrichedInventoryPath = path.join(absoluteOutputDir, 'wedding-master-inventory.enriched.json')
  const markdownPath = path.join(absoluteOutputDir, 'wedding-master-analysis.md')

  await writeJson(analysisPath, report)
  await writeJson(enrichedInventoryPath, enrichedInventory)

  const lines = [
    '# Wedding Master Analysis',
    '',
    `Root: \`${absoluteRoot}\``,
    '',
    `- Exact duplicate groups: **${report.exactDuplicateGroups.length}**`,
    `- Similar-shot groups: **${report.similarShotGroups.length}**`,
    `- Live photo groups: **${report.livePhotoGroups.length}**`,
    `- Story groups: **${report.storyGroups.length}**`,
    '',
    '## Cover Candidates',
    '',
  ]

  if (report.coverCandidates.length === 0) {
    lines.push('No cover candidates were generated.')
  } else {
    for (const bucket of report.coverCandidates) {
      lines.push(`### ${bucket.collection} / ${bucket.storyLaneSuggestion}`)
      lines.push('')
      lines.push(
        buildMarkdownTable(
          bucket.images.map((image) => ({
            Rank: image.rank,
            Quality: image.qualityScore,
            CaptureDate: image.captureDate ? image.captureDate.slice(0, 10) : '',
            File: image.relativePath,
          })),
          ['Rank', 'Quality', 'CaptureDate', 'File'],
        ),
      )
      lines.push('')
    }
  }

  lines.push('## Similar-Shot Groups')
  lines.push('')
  if (report.similarShotGroups.length === 0) {
    lines.push('No visually similar groups matched the current thresholds.')
  } else {
    for (const group of report.similarShotGroups.slice(0, 20)) {
      lines.push(`### ${group.similarGroupId} (${group.count} files)`)
      lines.push('')
      group.files.forEach((file) => {
        lines.push(`- \`${file.relativePath}\` (${file.qualityScore ?? 'n/a'})`)
      })
      lines.push('')
    }
  }

  lines.push('## Live Photo Groups')
  lines.push('')
  if (report.livePhotoGroups.length === 0) {
    lines.push('No live-photo style groupings were detected.')
  } else {
    lines.push(
      buildMarkdownTable(
        report.livePhotoGroups.slice(0, 40).map((group) => ({
          Group: group.livePhotoGroupId,
          Folder: group.folder,
          Clip: group.clip.relativePath,
          Duration: group.clip.durationSeconds == null ? '' : group.clip.durationSeconds.toFixed(2),
          Stills: group.stills.length,
        })),
        ['Group', 'Folder', 'Clip', 'Duration', 'Stills'],
      ),
    )
  }
  lines.push('')

  await writeMarkdown(markdownPath, lines)

  console.log(`Wrote analysis to ${analysisPath}`)
  console.log(`Wrote enriched inventory to ${enrichedInventoryPath}`)
  console.log(`Wrote markdown report to ${markdownPath}`)
}

await main()
