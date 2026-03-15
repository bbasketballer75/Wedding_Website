import path from 'node:path'
import { buildMarkdownTable, readJson, writeJson, writeMarkdown } from './photo-batch-utils.mjs'

const workingRoot = process.argv[2]
const reviewPathArg = process.argv[3]

if (!workingRoot) {
  console.error('Usage: node scripts/export-photo-import-manifest.mjs <working-root> [review-json]')
  process.exit(1)
}

function resolveConfirmedNames(reviewItems) {
  const byClusterId = new Map(reviewItems.map((item) => [item.clusterId, item]))

  function getResolvedName(clusterId, seen = new Set()) {
    if (!clusterId || seen.has(clusterId)) return null
    seen.add(clusterId)

    const item = byClusterId.get(clusterId)
    if (!item) return null
    if (item.confirmedName?.trim()) return item.confirmedName.trim()
    if (item.mergeIntoClusterId) return getResolvedName(item.mergeIntoClusterId, seen)
    return null
  }

  return new Map(reviewItems.map((item) => [item.clusterId, getResolvedName(item.clusterId)]))
}

function getSourcePriority(source) {
  switch (source) {
    case 'professional':
      return 3
    case 'bach+ette':
      return 2
    case 'guest':
      return 1
    default:
      return 0
  }
}

function pickCanonicalDuplicateRecord(records) {
  return [...records].sort((left, right) => {
    const sourceDelta = getSourcePriority(right.source) - getSourcePriority(left.source)
    if (sourceDelta !== 0) return sourceDelta

    const qualityDelta = (right.qualityScore ?? 0) - (left.qualityScore ?? 0)
    if (qualityDelta !== 0) return qualityDelta

    const dateDelta = String(left.captureDate ?? '').localeCompare(String(right.captureDate ?? ''))
    if (dateDelta !== 0) return dateDelta

    return left.relativePath.localeCompare(right.relativePath)
  })[0] ?? null
}

function buildDuplicateKeepers(inventory) {
  const groups = new Map()

  for (const record of inventory) {
    if (!record.duplicateGroupId || record.kind !== 'image') continue
    const current = groups.get(record.duplicateGroupId) ?? []
    current.push(record)
    groups.set(record.duplicateGroupId, current)
  }

  return new Map(
    [...groups.entries()].map(([duplicateGroupId, records]) => [
      duplicateGroupId,
      pickCanonicalDuplicateRecord(records),
    ]),
  )
}

function buildTags(record) {
  const tags = new Set([
    record.source,
    record.collection,
    record.storyLaneSuggestion,
  ].filter(Boolean))

  if (record.coverCandidateRank) tags.add(`cover-candidate-${record.coverCandidateRank}`)
  if (record.duplicateGroupId) tags.add('duplicate-group')
  if (record.similarGroupId) tags.add('similar-group')
  if (record.livePhotoGroupId) tags.add('live-photo')

  return [...tags]
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const catalogRoot = path.join(absoluteWorkingRoot, 'catalog')
  const facesRoot = path.join(absoluteWorkingRoot, 'faces')
  const optimizedRoot = path.join(absoluteWorkingRoot, 'optimized')
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')

  const inventory = await readJson(path.join(catalogRoot, 'wedding-master-inventory.enriched.json'))
  const optimizedManifest = await readJson(path.join(optimizedRoot, 'optimized-manifest.json'))
  const annotationsByPhoto = await readJson(path.join(facesRoot, 'face-annotations-by-photo.json'))
  const reviewItems = await readJson(reviewPathArg ? path.resolve(reviewPathArg) : path.join(facesRoot, 'face-review.json'))

  const recordById = new Map(inventory.map((record) => [record.id, record]))
  const annotationsByRecordId = new Map(annotationsByPhoto.map((annotation) => [annotation.recordId, annotation.faces]))
  const annotationsByRelativePath = new Map(
    annotationsByPhoto.map((annotation) => [annotation.relativePath, annotation.faces]),
  )
  const confirmedNames = resolveConfirmedNames(reviewItems)
  const duplicateKeepers = buildDuplicateKeepers(inventory)
  const exclusions = []

  const rows = optimizedManifest
    .filter((item) => item.type === 'image' && item.sourceRelativePath)
    .map((item) => {
      const record = [...recordById.values()].find((candidate) => candidate.relativePath === item.sourceRelativePath)
      const keeper = record?.duplicateGroupId ? duplicateKeepers.get(record.duplicateGroupId) : null

      if (record?.duplicateGroupId && keeper?.id && keeper.id !== record.id) {
        exclusions.push({
          reason: 'exact-duplicate-excluded',
          duplicateGroupId: record.duplicateGroupId,
          sourceRecordId: record.id,
          sourceRelativePath: record.relativePath,
          keptSourceRecordId: keeper.id,
          keptSourceRelativePath: keeper.relativePath,
          displayRelativePath: item.displayRelativePath,
          thumbnailRelativePath: item.thumbRelativePath,
          source: record.source ?? 'unknown',
          keptSource: keeper.source ?? 'unknown',
          qualityScore: record.qualityScore ?? null,
          keptQualityScore: keeper.qualityScore ?? null,
        })
        return null
      }

      const faces = (
        annotationsByRecordId.get(record?.id)
        ?? annotationsByRelativePath.get(record?.relativePath)
        ?? []
      )
        .map((face, index) => {
          const confirmedName = confirmedNames.get(face.clusterId)
          if (!confirmedName) return null

          return {
            id: `${face.clusterId}-${index + 1}`,
            name: confirmedName,
            x: face.x,
            y: face.y,
            box: face.box ?? null,
          }
        })
        .filter(Boolean)

      return {
        sourceRecordId: record?.id ?? null,
        sourceRelativePath: item.sourceRelativePath,
        displayRelativePath: item.displayRelativePath,
        thumbnailRelativePath: item.thumbRelativePath,
        source: record?.source ?? 'unknown',
        collection: item.collection ?? record?.collection ?? 'Uncategorized',
        category: item.collection ?? record?.collection ?? 'Uncategorized',
        storyLaneSuggestion: item.storyLaneSuggestion ?? record?.storyLaneSuggestion ?? 'review',
        memoryTrailSuggestion: record?.memoryTrailSuggestion ?? null,
        captureDate: record?.captureDate ?? null,
        location:
          typeof record?.latitude === 'number' && typeof record?.longitude === 'number'
            ? `${record.latitude}, ${record.longitude}`
            : null,
        qualityScore: record?.qualityScore ?? null,
        coverCandidateRank: item.coverCandidateRank ?? record?.coverCandidateRank ?? null,
        duplicateGroupId: item.duplicateGroupId ?? record?.duplicateGroupId ?? null,
        similarGroupId: item.similarGroupId ?? record?.similarGroupId ?? null,
        livePhotoGroupId: item.livePhotoGroupId ?? record?.livePhotoGroupId ?? null,
        tags: buildTags({
          source: record?.source,
          collection: item.collection ?? record?.collection,
          storyLaneSuggestion: item.storyLaneSuggestion ?? record?.storyLaneSuggestion,
          coverCandidateRank: item.coverCandidateRank ?? record?.coverCandidateRank,
          duplicateGroupId: item.duplicateGroupId ?? record?.duplicateGroupId,
          similarGroupId: item.similarGroupId ?? record?.similarGroupId,
          livePhotoGroupId: item.livePhotoGroupId ?? record?.livePhotoGroupId,
        }),
        faces,
        photoRowDraft: {
          url: item.displayRelativePath,
          thumbnail: item.thumbRelativePath,
          caption: null,
          category: item.collection ?? record?.collection ?? 'Uncategorized',
          location:
            typeof record?.latitude === 'number' && typeof record?.longitude === 'number'
              ? `${record.latitude}, ${record.longitude}`
              : null,
          date: record?.captureDate ?? null,
          photographer: record?.source === 'professional' ? 'Batch Import (Professional)' : 'Batch Import',
          is_professional: record?.source === 'professional',
          tags: buildTags({
            source: record?.source,
            collection: item.collection ?? record?.collection,
            storyLaneSuggestion: item.storyLaneSuggestion ?? record?.storyLaneSuggestion,
            coverCandidateRank: item.coverCandidateRank ?? record?.coverCandidateRank,
            duplicateGroupId: item.duplicateGroupId ?? record?.duplicateGroupId,
            similarGroupId: item.similarGroupId ?? record?.similarGroupId,
            livePhotoGroupId: item.livePhotoGroupId ?? record?.livePhotoGroupId,
          }),
          faces,
        },
      }
    })
    .filter(Boolean)

  const manifestPath = path.join(publishRoot, 'wedding-photo-import-manifest.json')
  const markdownPath = path.join(publishRoot, 'wedding-photo-import-manifest.md')
  const exclusionsPath = path.join(publishRoot, 'wedding-photo-import-exclusions.json')
  const exclusionsMarkdownPath = path.join(publishRoot, 'wedding-photo-import-exclusions.md')

  await writeJson(manifestPath, rows)
  await writeJson(exclusionsPath, exclusions)
  await writeMarkdown(markdownPath, [
    '# Wedding Photo Import Manifest',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Rows: **${rows.length}**`,
    `Rows with confirmed faces: **${rows.filter((row) => row.faces.length > 0).length}**`,
    `Exact duplicates excluded: **${exclusions.length}**`,
    '',
    buildMarkdownTable(
      rows.slice(0, 30).map((row) => ({
        Source: row.sourceRelativePath,
        Display: row.displayRelativePath,
        Collection: row.collection,
        StoryLane: row.storyLaneSuggestion,
        Faces: row.faces.length,
      })),
      ['Source', 'Display', 'Collection', 'StoryLane', 'Faces'],
    ),
  ])
  await writeMarkdown(exclusionsMarkdownPath, [
    '# Wedding Photo Import Exclusions',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Excluded exact duplicates: **${exclusions.length}**`,
    '',
    exclusions.length === 0
      ? 'No exact duplicate rows were excluded.'
      : buildMarkdownTable(
          exclusions.slice(0, 50).map((row) => ({
            Source: row.sourceRelativePath,
            Kept: row.keptSourceRelativePath,
            Group: row.duplicateGroupId,
            SourceType: row.keptSource,
          })),
          ['Source', 'Kept', 'Group', 'SourceType'],
        ),
  ])

  console.log(`Wrote import manifest to ${manifestPath}`)
  console.log(`Wrote markdown summary to ${markdownPath}`)
  console.log(`Wrote exclusions to ${exclusionsPath}`)
}

await main()
