import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import exifr from 'exifr'
import {
  createStableId,
  readJson,
  slugify,
  toPosix,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const workingRoot = process.argv[2]
const organizationManifestArg = process.argv[3]
const reviewPathArg = process.argv[4]

if (!workingRoot) {
  console.error('Usage: node scripts/import-digikam-face-metadata.mjs <working-root> [organization-manifest] [review-json]')
  process.exit(1)
}

const FACE_CROP_SIZE = 256
const FACE_MARGIN_RATIO = 0.2
const DUPLICATE_REVIEW_PREFIX = 'Review/Exact Duplicates/'

function round(value, precision = 2) {
  return Number(value.toFixed(precision))
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function candidateSidecarPaths(imagePath) {
  const parsed = path.parse(imagePath)
  return [
    `${imagePath}.xmp`,
    path.join(parsed.dir, `${parsed.name}.xmp`),
  ]
}

async function loadImageXmp(imagePath) {
  for (const sidecarPath of candidateSidecarPaths(imagePath)) {
    if (!(await pathExists(sidecarPath))) continue

    try {
      const metadata = await exifr.sidecar(sidecarPath)
      if (metadata) {
        return {
          metadata,
          source: 'sidecar',
          sidecarPath,
        }
      }
    } catch {
      // Fall through to alternate paths / embedded metadata.
    }
  }

  try {
    const metadata = await exifr.parse(imagePath, true)
    if (metadata) {
      return {
        metadata,
        source: 'embedded',
        sidecarPath: null,
      }
    }
  } catch {
    // Ignore unreadable embedded metadata and treat the file as untagged.
  }

  return {
    metadata: null,
    source: null,
    sidecarPath: null,
  }
}

function resolveRegionContainer(metadata) {
  return (
    metadata?.['mwg-rs']?.Regions ??
    metadata?.Regions ??
    metadata?.regions ??
    null
  )
}

function extractNamedRegions(metadata, imageDimensions) {
  const regionContainer = resolveRegionContainer(metadata)
  const appliedDimensions = regionContainer?.AppliedToDimensions ?? null
  const appliedWidth = typeof appliedDimensions?.w === 'number' ? appliedDimensions.w : imageDimensions.width
  const appliedHeight = typeof appliedDimensions?.h === 'number' ? appliedDimensions.h : imageDimensions.height
  const regionList = asArray(regionContainer?.RegionList)

  return regionList
    .map((region, index) => {
      const name = String(region?.Name ?? '').trim()
      const area = region?.Area ?? null
      if (!name || !area) return null

      const unit = String(area.unit ?? '').toLowerCase()
      const rawX = Number(area.x)
      const rawY = Number(area.y)
      const rawWidth = Number(area.w)
      const rawHeight = Number(area.h)

      if (![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite)) {
        return null
      }

      const useNormalized = unit === 'normalized' || (
        rawX <= 1.01 &&
        rawY <= 1.01 &&
        rawWidth <= 1.01 &&
        rawHeight <= 1.01
      )

      if (!useNormalized && (!appliedWidth || !appliedHeight)) {
        return null
      }

      const normalized = useNormalized
        ? { x: rawX, y: rawY, width: rawWidth, height: rawHeight }
        : {
            x: rawX / appliedWidth,
            y: rawY / appliedHeight,
            width: rawWidth / appliedWidth,
            height: rawHeight / appliedHeight,
          }

      const left = Math.max(0, normalized.x - (normalized.width / 2))
      const top = Math.max(0, normalized.y - (normalized.height / 2))

      return {
        name,
        personKey: slugify(name),
        regionIndex: index,
        x: round(normalized.x * 100),
        y: round(normalized.y * 100),
        normalizedBox: {
          left: round(left * 100),
          top: round(top * 100),
          width: round(normalized.width * 100),
          height: round(normalized.height * 100),
        },
      }
    })
    .filter(Boolean)
}

function buildPixelCrop(region, imageDimensions) {
  const left = Math.max(0, Math.floor((region.normalizedBox.left / 100) * imageDimensions.width))
  const top = Math.max(0, Math.floor((region.normalizedBox.top / 100) * imageDimensions.height))
  const width = Math.max(1, Math.round((region.normalizedBox.width / 100) * imageDimensions.width))
  const height = Math.max(1, Math.round((region.normalizedBox.height / 100) * imageDimensions.height))
  const marginX = Math.round(width * FACE_MARGIN_RATIO)
  const marginY = Math.round(height * FACE_MARGIN_RATIO)
  const cropLeft = Math.max(0, left - marginX)
  const cropTop = Math.max(0, top - marginY)
  const cropWidth = Math.min(imageDimensions.width - cropLeft, width + (marginX * 2))
  const cropHeight = Math.min(imageDimensions.height - cropTop, height + (marginY * 2))

  return {
    left,
    top,
    width,
    height,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
  }
}

async function writeFaceCrop(imagePath, clusterId, faceId, crop, cropsRoot) {
  const clusterDir = path.join(cropsRoot, clusterId)
  const cropPath = path.join(clusterDir, `${faceId}.webp`)
  await fs.mkdir(clusterDir, { recursive: true })

  try {
    await sharp(imagePath, { failOn: 'none' })
      .rotate()
      .extract({
        left: crop.cropLeft,
        top: crop.cropTop,
        width: crop.cropWidth,
        height: crop.cropHeight,
      })
      .resize(FACE_CROP_SIZE, FACE_CROP_SIZE, { fit: 'cover' })
      .webp({ quality: 82, effort: 4 })
      .toFile(cropPath)
  } catch {
    await sharp(imagePath, { failOn: 'none' })
      .rotate()
      .resize(FACE_CROP_SIZE, FACE_CROP_SIZE, { fit: 'cover' })
      .webp({ quality: 82, effort: 4 })
      .toFile(cropPath)
  }

  return toPosix(path.relative(path.dirname(cropsRoot), cropPath))
}

function buildClusterSummary(detectionsByCluster) {
  return [...detectionsByCluster.values()]
    .map((cluster) => ({
      clusterId: cluster.clusterId,
      memberCount: cluster.members.length,
      averageQualityScore: null,
      members: cluster.members.map((member) => ({
        faceId: member.faceId,
        sourceRecordId: member.sourceRecordId,
        sourceRelativePath: member.sourceRelativePath,
        x: member.x,
        y: member.y,
        box: member.box,
        boxScore: null,
        faceScore: null,
        thumbnailPath: member.thumbnailPath,
        name: member.confirmedName,
      })),
    }))
    .sort((left, right) => right.memberCount - left.memberCount || left.clusterId.localeCompare(right.clusterId))
}

function buildReviewTemplate(clusterSummary, existingReview = []) {
  const existingByClusterId = new Map(existingReview.map((entry) => [entry.clusterId, entry]))

  return clusterSummary.map((cluster) => {
    const existing = existingByClusterId.get(cluster.clusterId)
    const label = cluster.members[0]?.name || existing?.confirmedName || existing?.suggestedLabel || cluster.clusterId

    return {
      clusterId: cluster.clusterId,
      suggestedLabel: label,
      confirmedName: label,
      reviewStatus: 'confirmed',
      mergeIntoClusterId: null,
      notes: existing?.notes ?? '',
      memberFaceIds: cluster.members.map((member) => member.faceId),
      sampleFiles: cluster.members.slice(0, 8).map((member) => member.sourceRelativePath),
    }
  })
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const organizationManifestPath = organizationManifestArg
    ? path.resolve(organizationManifestArg)
    : path.join(absoluteWorkingRoot, 'organized', 'organization-manifest.json')
  const reviewPath = reviewPathArg
    ? path.resolve(reviewPathArg)
    : path.join(absoluteWorkingRoot, 'faces', 'face-review.json')

  const organizationManifest = await readJson(organizationManifestPath)
  const imageItems = organizationManifest.filter((item) =>
    item.kind === 'image' &&
    item.destination &&
    !String(item.destinationRelativePath || '').startsWith(DUPLICATE_REVIEW_PREFIX),
  )

  let existingReview = []
  try {
    existingReview = await readJson(reviewPath)
  } catch {
    existingReview = []
  }

  const detections = []
  const detectionsByCluster = new Map()
  const annotationsByPhoto = []
  const cropsRoot = path.join(absoluteWorkingRoot, 'faces', 'crops')
  let taggedPhotoCount = 0
  let sidecarCount = 0
  let embeddedCount = 0

  for (const item of imageItems) {
    const imagePath = path.resolve(item.destination)
    const { metadata, source, sidecarPath } = await loadImageXmp(imagePath)
    const imageMetadata = await sharp(imagePath, { failOn: 'none' }).rotate().metadata()
    const imageDimensions = {
      width: imageMetadata.width ?? 0,
      height: imageMetadata.height ?? 0,
    }

    if (!metadata || !imageDimensions.width || !imageDimensions.height) {
      annotationsByPhoto.push({
        recordId: item.id,
        relativePath: item.relativePath,
        faces: [],
      })
      continue
    }

    const regions = extractNamedRegions(metadata, imageDimensions)
    if (regions.length === 0) {
      annotationsByPhoto.push({
        recordId: item.id,
        relativePath: item.relativePath,
        faces: [],
      })
      continue
    }

    taggedPhotoCount += 1
    if (source === 'sidecar') sidecarCount += 1
    if (source === 'embedded') embeddedCount += 1

    const photoFaces = []
    for (const region of regions) {
      const clusterId = createStableId('cluster', region.personKey || region.name.toLowerCase())
      const crop = buildPixelCrop(region, imageDimensions)
      const faceId = createStableId(
        'face',
        item.id,
        clusterId,
        String(region.regionIndex),
        `${region.x}:${region.y}`,
      )
      const thumbnailPath = await writeFaceCrop(imagePath, clusterId, faceId, crop, cropsRoot)
      const detection = {
        faceId,
        sourceRecordId: item.id,
        sourceRelativePath: item.relativePath,
        organizedRelativePath: item.destinationRelativePath,
        collection: item.collection,
        storyLaneSuggestion: item.storyLaneSuggestion,
        confirmedName: region.name,
        personKey: region.personKey || slugify(region.name) || clusterId,
        x: region.x,
        y: region.y,
        box: {
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        },
        detectionDimensions: imageDimensions,
        qualityScore: null,
        boxScore: null,
        faceScore: null,
        thumbnailPath,
        metadataSource: source,
        sidecarPath: sidecarPath ? toPosix(path.relative(absoluteWorkingRoot, sidecarPath)) : null,
      }

      detections.push(detection)
      photoFaces.push({
        faceId,
        clusterId,
        name: region.name,
        x: region.x,
        y: region.y,
        box: {
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        },
      })

      const currentCluster = detectionsByCluster.get(clusterId) ?? {
        clusterId,
        name: region.name,
        members: [],
      }
      currentCluster.members.push({
        ...detection,
        thumbnailPath,
      })
      detectionsByCluster.set(clusterId, currentCluster)
    }

    annotationsByPhoto.push({
      recordId: item.id,
      relativePath: item.relativePath,
      faces: photoFaces,
    })
  }

  const clusterSummary = buildClusterSummary(detectionsByCluster)
  const reviewTemplate = buildReviewTemplate(clusterSummary, existingReview)
  const facesRoot = path.join(absoluteWorkingRoot, 'faces')
  const detectionsPath = path.join(facesRoot, 'face-detections.json')
  const clustersPath = path.join(facesRoot, 'face-clusters.json')
  const annotationsPath = path.join(facesRoot, 'face-annotations-by-photo.json')
  const markdownPath = path.join(facesRoot, 'face-clusters.md')

  await writeJson(detectionsPath, detections)
  await writeJson(clustersPath, clusterSummary)
  await writeJson(annotationsPath, annotationsByPhoto)
  await writeJson(reviewPath, reviewTemplate)

  await writeMarkdown(markdownPath, [
    '# digiKam Face Import Summary',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Tagged photos imported: **${taggedPhotoCount}**`,
    `Named faces imported: **${detections.length}**`,
    `People groups imported: **${clusterSummary.length}**`,
    `Sidecar-backed photos: **${sidecarCount}**`,
    `Embedded-XMP photos: **${embeddedCount}**`,
    '',
    '## Notes',
    '- Exact-duplicate review copies are skipped automatically so duplicate guest uploads do not pollute the tagging queue.',
    '- Each imported person group is treated as confirmed because digiKam is the source of truth for this workflow.',
    '- Re-run this importer after `Album -> Write Metadata to Files` in digiKam whenever face tags change.',
    '',
    ...clusterSummary.slice(0, 40).flatMap((cluster) => ([
      `## ${cluster.members[0]?.name || cluster.clusterId}`,
      '',
      `- Cluster ID: \`${cluster.clusterId}\``,
      `- Members: ${cluster.memberCount}`,
      '',
      ...cluster.members.slice(0, 8).map((member) => `- \`${member.sourceRelativePath}\``),
      '',
    ])),
  ])

  console.log(`Imported ${detections.length} named faces from digiKam metadata`)
  console.log(`Wrote face detections to ${detectionsPath}`)
  console.log(`Wrote face clusters to ${clustersPath}`)
  console.log(`Wrote review template to ${reviewPath}`)
  console.log(`Wrote annotations to ${annotationsPath}`)
}

await main()
