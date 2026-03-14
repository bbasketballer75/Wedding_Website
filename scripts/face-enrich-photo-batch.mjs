import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import {
  createStableId,
  readJson,
  toPosix,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const Human = await import(pathToFileURL(path.resolve('node_modules/@vladmandic/human/dist/human.node-wasm.js')).href)

const sourceRoot = process.argv[2]
const workingRoot = process.argv[3]
const inventoryPathArg = process.argv[4]
const analysisPathArg = process.argv[5]
const reviewPathArg = process.argv[6]

if (!sourceRoot || !workingRoot) {
  console.error('Usage: node scripts/face-enrich-photo-batch.mjs <source-root> <working-root> [inventory-json] [analysis-json] [review-json]')
  process.exit(1)
}

const DETECTION_LONG_EDGE = 1600
const CLUSTER_SIMILARITY_THRESHOLD = 0.82

function guessContentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.bin')) return 'application/octet-stream'
  if (filePath.endsWith('.wasm')) return 'application/wasm'
  return 'application/octet-stream'
}

function fileUrlToPath(fileUrl) {
  const url = new URL(fileUrl)
  let pathname = decodeURIComponent(url.pathname)
  if (/^\/[A-Za-z]:/.test(pathname)) pathname = pathname.slice(1)
  return pathname
}

function enableFileFetch() {
  if (!globalThis.fetch || globalThis.__weddingFileFetchEnabled) return

  const nativeFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (resource, init) => {
    const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url
    if (url.startsWith('file://')) {
      const filePath = fileUrlToPath(url)
      const buffer = await fs.readFile(filePath)
      return new Response(buffer, {
        status: 200,
        headers: {
          'content-type': guessContentType(filePath),
        },
      })
    }

    return nativeFetch(resource, init)
  }

  globalThis.__weddingFileFetchEnabled = true
}

function cosineSimilarity(left, right) {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] ** 2
    rightMagnitude += right[index] ** 2
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

function averageDescriptor(vectors) {
  const length = vectors[0]?.length ?? 0
  const merged = new Array(length).fill(0)

  for (const vector of vectors) {
    for (let index = 0; index < vector.length; index += 1) {
      merged[index] += vector[index]
    }
  }

  return merged.map((value) => value / Math.max(vectors.length, 1))
}

function buildFaceConfig() {
  const modelBasePath = `file://${path.resolve('node_modules/@vladmandic/human/models').replace(/\\/g, '/')}/`
  const wasmPath = `${path.resolve('node_modules/@tensorflow/tfjs-backend-wasm/dist').replace(/\\/g, '/')}/`

  return {
    backend: 'wasm',
    wasmPath,
    modelBasePath,
    cacheSensitivity: 0,
    debug: false,
    async: false,
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    face: {
      enabled: true,
      detector: {
        rotation: false,
        maxDetected: 10,
        minConfidence: 0.25,
      },
      mesh: { enabled: false },
      iris: { enabled: false },
      emotion: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
      description: { enabled: true, minConfidence: 0.1 },
    },
  }
}

async function loadHuman() {
  enableFileFetch()
  const human = new Human.Human(buildFaceConfig())
  await human.init()
  await human.load()
  return human
}

async function detectFacesForImage(human, imagePath, record) {
  const image = sharp(imagePath, { failOn: 'none' }).rotate()
  const resized = image.clone().resize({
    width: DETECTION_LONG_EDGE,
    height: DETECTION_LONG_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  })
  const { data, info } = await resized.removeAlpha().raw().toBuffer({ resolveWithObject: true })

  const tensor = human.tf.tidy(() => {
    const decoded = human.tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], 'int32')
    const expanded = human.tf.expandDims(decoded, 0)
    return human.tf.cast(expanded, 'float32')
  })

  const result = await human.detect(tensor)
  human.tf.dispose(tensor)

  const faces = []
  for (const [index, face] of (result.face ?? []).entries()) {
    if (!face.embedding || !face.box || face.box.length < 4) continue

    const [left, top, width, height] = face.box
    const centerX = Number((((left + (width / 2)) / info.width) * 100).toFixed(2))
    const centerY = Number((((top + (height / 2)) / info.height) * 100).toFixed(2))
    const cropLeft = Math.max(0, Math.floor(left - (width * 0.2)))
    const cropTop = Math.max(0, Math.floor(top - (height * 0.2)))
    const cropWidth = Math.min(info.width - cropLeft, Math.ceil(width * 1.4))
    const cropHeight = Math.min(info.height - cropTop, Math.ceil(height * 1.4))
    const faceId = createStableId('face', record.id, String(index), `${centerX}:${centerY}`)

    faces.push({
      faceId,
      sourceRecordId: record.id,
      sourceRelativePath: record.relativePath,
      topLevelFolder: record.topLevelFolder,
      collection: record.collection,
      storyLaneSuggestion: record.storyLaneSuggestion,
      qualityScore: record.qualityScore,
      box: {
        left: Number(left.toFixed(2)),
        top: Number(top.toFixed(2)),
        width: Number(width.toFixed(2)),
        height: Number(height.toFixed(2)),
      },
      x: centerX,
      y: centerY,
      boxScore: face.boxScore ?? null,
      faceScore: face.faceScore ?? null,
      embedding: Array.from(face.embedding),
      crop: {
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
      },
      detectionDimensions: {
        width: info.width,
        height: info.height,
      },
      captureDate: record.captureDate,
      thumbnailPath: null,
    })
  }

  return faces
}

function clusterFaces(detections) {
  const sorted = [...detections].sort((left, right) => {
    return (right.qualityScore || 0) - (left.qualityScore || 0) ||
      (right.faceScore || 0) - (left.faceScore || 0)
  })

  const clusters = []
  for (const detection of sorted) {
    let bestCluster = null
    let bestSimilarity = -1

    for (const cluster of clusters) {
      const similarity = cosineSimilarity(detection.embedding, cluster.centroid)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestCluster = cluster
      }
    }

    if (!bestCluster || bestSimilarity < CLUSTER_SIMILARITY_THRESHOLD) {
      clusters.push({
        members: [detection],
        centroid: detection.embedding,
        bestSimilarity: 1,
      })
      continue
    }

    bestCluster.members.push(detection)
    bestCluster.centroid = averageDescriptor(bestCluster.members.map((member) => member.embedding))
    bestCluster.bestSimilarity = Math.max(bestCluster.bestSimilarity, bestSimilarity)
  }

  return clusters.map((cluster) => {
    const memberIds = cluster.members.map((member) => member.faceId).sort()
    const clusterId = createStableId('cluster', ...memberIds)
    return {
      clusterId,
      memberCount: cluster.members.length,
      centroid: cluster.centroid,
      members: cluster.members
        .sort((left, right) => {
          return (right.qualityScore || 0) - (left.qualityScore || 0) ||
            left.sourceRelativePath.localeCompare(right.sourceRelativePath)
        }),
      averageQualityScore: Number(
        (
          cluster.members.reduce((sum, member) => sum + (member.qualityScore || 0), 0) /
          Math.max(cluster.members.length, 1)
        ).toFixed(2),
      ),
    }
  }).sort((left, right) => right.memberCount - left.memberCount || right.averageQualityScore - left.averageQualityScore)
}

function mergeReviewState(existingReview, clusters) {
  const existingByClusterId = new Map((existingReview ?? []).map((entry) => [entry.clusterId, entry]))

  return clusters.map((cluster, index) => {
    const existing = existingByClusterId.get(cluster.clusterId)
    return {
      clusterId: cluster.clusterId,
      suggestedLabel: existing?.suggestedLabel ?? `Person ${index + 1}`,
      confirmedName: existing?.confirmedName ?? null,
      reviewStatus: existing?.reviewStatus ?? 'pending',
      mergeIntoClusterId: existing?.mergeIntoClusterId ?? null,
      notes: existing?.notes ?? '',
      memberFaceIds: cluster.members.map((member) => member.faceId),
      sampleFiles: cluster.members.slice(0, 8).map((member) => member.sourceRelativePath),
    }
  })
}

async function writeFaceCrops(sourceRootPath, clusterSummaries, cropsRoot) {
  for (const cluster of clusterSummaries) {
    const clusterDir = path.join(cropsRoot, cluster.clusterId)
    await fs.mkdir(clusterDir, { recursive: true })

    for (const member of cluster.members) {
      const sourcePath = path.join(sourceRootPath, ...member.sourceRelativePath.split('/'))
      const cropPath = path.join(clusterDir, `${member.faceId}.webp`)
      const resized = sharp(sourcePath, { failOn: 'none' })
        .rotate()
        .resize({
          width: DETECTION_LONG_EDGE,
          height: DETECTION_LONG_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
      const metadata = await resized.metadata()
      const maxWidth = metadata.width ?? 0
      const maxHeight = metadata.height ?? 0
      if (maxWidth < 1 || maxHeight < 1) continue

      const cropLeft = Math.max(0, Math.min(Math.round(member.crop.left), Math.max(maxWidth - 1, 0)))
      const cropTop = Math.max(0, Math.min(Math.round(member.crop.top), Math.max(maxHeight - 1, 0)))
      const cropWidth = Math.max(1, Math.min(Math.round(member.crop.width), maxWidth - cropLeft))
      const cropHeight = Math.max(1, Math.min(Math.round(member.crop.height), maxHeight - cropTop))

      try {
        await resized
          .extract({
            left: cropLeft,
            top: cropTop,
            width: cropWidth,
            height: cropHeight,
          })
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 82, effort: 4 })
          .toFile(cropPath)
      } catch {
        await sharp(sourcePath, { failOn: 'none' })
          .rotate()
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 82, effort: 4 })
          .toFile(cropPath)
      }

      member.thumbnailPath = toPosix(path.relative(path.dirname(cropsRoot), cropPath))
    }
  }
}

function buildClusterSummary(clusters) {
  return clusters.map((cluster) => ({
    clusterId: cluster.clusterId,
    memberCount: cluster.memberCount,
    averageQualityScore: cluster.averageQualityScore,
    members: cluster.members.map((member) => ({
      faceId: member.faceId,
      sourceRecordId: member.sourceRecordId,
      sourceRelativePath: member.sourceRelativePath,
      x: member.x,
      y: member.y,
      box: member.box,
      boxScore: member.boxScore,
      faceScore: member.faceScore,
      thumbnailPath: member.thumbnailPath,
    })),
  }))
}

async function main() {
  const absoluteSourceRoot = path.resolve(sourceRoot)
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const inventoryPath = inventoryPathArg
    ? path.resolve(inventoryPathArg)
    : path.join(absoluteWorkingRoot, 'catalog', 'wedding-master-inventory.enriched.json')
  const analysisPath = analysisPathArg
    ? path.resolve(analysisPathArg)
    : path.join(absoluteWorkingRoot, 'catalog', 'wedding-master-analysis.json')
  const reviewPath = reviewPathArg
    ? path.resolve(reviewPathArg)
    : path.join(absoluteWorkingRoot, 'faces', 'face-review.json')

  const inventory = await readJson(inventoryPath)
  await readJson(analysisPath)
  const imageRecords = inventory.filter((record) => record.kind === 'image')

  let existingReview = []
  try {
    existingReview = await readJson(reviewPath)
  } catch {
    existingReview = []
  }

  const human = await loadHuman()
  const detections = []
  for (const record of imageRecords) {
    const sourcePath = path.join(absoluteSourceRoot, ...record.relativePath.split('/'))
    detections.push(...await detectFacesForImage(human, sourcePath, record))
  }

  const clusters = clusterFaces(detections)
  const cropsRoot = path.join(absoluteWorkingRoot, 'faces', 'crops')
  await writeFaceCrops(absoluteSourceRoot, clusters, cropsRoot)

  const clusterSummary = buildClusterSummary(clusters)
  const reviewTemplate = mergeReviewState(existingReview, clusterSummary)
  const annotationsByPhoto = imageRecords.map((record) => ({
    recordId: record.id,
    relativePath: record.relativePath,
    faces: detections
      .filter((detection) => detection.sourceRecordId === record.id)
      .map((detection) => ({
        faceId: detection.faceId,
        clusterId: clusterSummary.find((cluster) => cluster.members.some((member) => member.faceId === detection.faceId))?.clusterId ?? null,
        x: detection.x,
        y: detection.y,
        box: detection.box,
      })),
  }))

  const detectionsPath = path.join(absoluteWorkingRoot, 'faces', 'face-detections.json')
  const clustersPath = path.join(absoluteWorkingRoot, 'faces', 'face-clusters.json')
  const annotationsPath = path.join(absoluteWorkingRoot, 'faces', 'face-annotations-by-photo.json')
  const markdownPath = path.join(absoluteWorkingRoot, 'faces', 'face-clusters.md')

  await writeJson(detectionsPath, detections.map((detection) => ({
    ...detection,
    embedding: undefined,
  })))
  await writeJson(clustersPath, clusterSummary)
  await writeJson(annotationsPath, annotationsByPhoto)
  await writeJson(reviewPath, reviewTemplate)

  const lines = [
    '# Face Cluster Review',
    '',
    `Source root: \`${absoluteSourceRoot}\``,
    '',
    `Detected faces: **${detections.length}**`,
    `Clusters: **${clusterSummary.length}**`,
    '',
    '## Review Instructions',
    '',
    '- Fill in `confirmedName` in `face-review.json` only after checking the crop thumbnails.',
    '- Use `mergeIntoClusterId` when two clusters are actually the same person.',
    '- Leave unresolved groups pending; they will be omitted from the import-ready manifest.',
    '',
  ]

  for (const cluster of clusterSummary.slice(0, 40)) {
    lines.push(`## ${cluster.clusterId}`)
    lines.push('')
    lines.push(`- Members: ${cluster.memberCount}`)
    lines.push(`- Average quality score: ${cluster.averageQualityScore}`)
    lines.push('')
    cluster.members.slice(0, 8).forEach((member) => {
      lines.push(`- \`${member.sourceRelativePath}\` at (${member.x}%, ${member.y}%)`)
    })
    lines.push('')
  }

  await writeMarkdown(markdownPath, lines)

  console.log(`Wrote face detections to ${detectionsPath}`)
  console.log(`Wrote face clusters to ${clustersPath}`)
  console.log(`Wrote review template to ${reviewPath}`)
  console.log(`Wrote annotations to ${annotationsPath}`)
}

await main()
