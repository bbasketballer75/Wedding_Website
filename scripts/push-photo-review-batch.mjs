import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import tus from 'tus-js-client'
import { createClient } from '@supabase/supabase-js'
import {
  assertExists,
  createStableId,
  readJson,
  slugify,
  toSiteMediaPath,
  toPosix,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = process.env.SUPABASE_REVIEW_BUCKET || 'media-review-artifacts'

const workingRoot = process.argv[2]

if (!workingRoot) {
  console.error('Usage: node scripts/push-photo-review-batch.mjs <working-root>')
  process.exit(1)
}

if (!PROJECT_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function ensureBucket() {
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(BUCKET_NAME)

  if (!getBucketError && existingBucket) {
    return
  }

  const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: false,
  })

  if (createBucketError) {
    throw createBucketError
  }
}

async function uploadFile(filePath, objectName) {
  const fileSize = fs.statSync(filePath).size

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(fs.createReadStream(filePath), {
      endpoint: `${PROJECT_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        'x-upsert': 'true',
      },
      uploadSize: fileSize,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: BUCKET_NAME,
        objectName,
        contentType: 'application/octet-stream',
        cacheControl: '31536000',
      },
      onError(error) {
        reject(error)
      },
      onSuccess() {
        resolve()
      },
    })

    upload.start()
  })
}

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

function buildArtifactPaths(prefix) {
  return {
    detections: `${prefix}/faces/face-detections.json`,
    clusters: `${prefix}/faces/face-clusters.json`,
    review: `${prefix}/faces/face-review.json`,
    annotations: `${prefix}/faces/face-annotations-by-photo.json`,
    markdown: `${prefix}/faces/face-clusters.md`,
    importManifest: `${prefix}/publish/wedding-photo-import-manifest.json`,
    importManifestSummary: `${prefix}/publish/wedding-photo-import-manifest.md`,
  }
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

function resolveClusterStatus(review) {
  if (!review) return 'pending'
  if (review.reviewStatus === 'confirmed') return 'confirmed'
  if (review.reviewStatus === 'ignored') return 'ignored'
  return 'pending'
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const facesRoot = path.join(absoluteWorkingRoot, 'faces')
  const cropsRoot = path.join(facesRoot, 'crops')
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')

  const detectionsPath = path.join(facesRoot, 'face-detections.json')
  const clustersPath = path.join(facesRoot, 'face-clusters.json')
  const reviewPath = path.join(facesRoot, 'face-review.json')
  const annotationsPath = path.join(facesRoot, 'face-annotations-by-photo.json')
  const markdownPath = path.join(facesRoot, 'face-clusters.md')
  const importManifestPath = path.join(publishRoot, 'wedding-photo-import-manifest.json')
  const importManifestSummaryPath = path.join(publishRoot, 'wedding-photo-import-manifest.md')

  await Promise.all([
    assertExists(detectionsPath, 'face detections'),
    assertExists(clustersPath, 'face clusters'),
    assertExists(reviewPath, 'face review'),
    assertExists(annotationsPath, 'face annotations'),
    assertExists(markdownPath, 'face cluster summary'),
    assertExists(importManifestPath, 'photo import manifest'),
  ])

  const [detections, clusters, reviewItems, importManifest] = await Promise.all([
    readJson(detectionsPath),
    readJson(clustersPath),
    readJson(reviewPath),
    readJson(importManifestPath),
  ])

  const batchKey = createStableId(
    'review-batch',
    absoluteWorkingRoot,
    String(clusters.length),
    clusters.map((cluster) => cluster.clusterId).join('::'),
  )
  const artifactPrefix = batchKey
  const artifactPaths = buildArtifactPaths(artifactPrefix)

  await ensureBucket()

  const staticArtifacts = [
    [detectionsPath, artifactPaths.detections],
    [clustersPath, artifactPaths.clusters],
    [reviewPath, artifactPaths.review],
    [annotationsPath, artifactPaths.annotations],
    [markdownPath, artifactPaths.markdown],
    [importManifestPath, artifactPaths.importManifest],
    [importManifestSummaryPath, artifactPaths.importManifestSummary],
  ]

  const cropFiles = await walk(cropsRoot)
  const uploadTargets = [
    ...staticArtifacts,
    ...cropFiles.map((filePath) => [
      filePath,
      `${artifactPrefix}/faces/${toPosix(path.relative(facesRoot, filePath))}`,
    ]),
  ]

  for (const [filePath, objectPath] of uploadTargets) {
    await uploadFile(filePath, objectPath)
  }

  const { data: existingBatch, error: batchLookupError } = await supabase
    .from('media_review_batches')
    .select('*')
    .eq('batch_key', batchKey)
    .maybeSingle()

  if (batchLookupError) {
    throw batchLookupError
  }

  const batchPayload = {
    batch_key: batchKey,
    label: path.basename(absoluteWorkingRoot),
    status: existingBatch?.status ?? 'pending',
    source_root: null,
    working_root: absoluteWorkingRoot,
    artifact_bucket: BUCKET_NAME,
    artifact_prefix: artifactPrefix,
    artifact_paths: artifactPaths,
    cluster_count: clusters.length,
    detection_count: detections.length,
    pushed_by_user_id: existingBatch?.pushed_by_user_id ?? null,
    pushed_by_email: existingBatch?.pushed_by_email ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data: batchRow, error: batchUpsertError } = await supabase
    .from('media_review_batches')
    .upsert(batchPayload, { onConflict: 'batch_key' })
    .select('*')
    .single()

  if (batchUpsertError) {
    throw batchUpsertError
  }

  const reviewByClusterId = new Map(reviewItems.map((item) => [item.clusterId, item]))
  const resolvedNames = resolveConfirmedNames(reviewItems)
  const clusterByFaceId = new Map()
  const clusterById = new Map(clusters.map((cluster) => [cluster.clusterId, cluster]))
  const importManifestByRecordId = new Map(
    importManifest
      .filter((row) => row.sourceRecordId)
      .map((row) => [row.sourceRecordId, row]),
  )

  for (const cluster of clusters) {
    for (const member of cluster.members) {
      if (member.faceId) {
        clusterByFaceId.set(member.faceId, cluster)
      }
    }
  }

  const { error: deleteClustersError } = await supabase
    .from('media_review_clusters')
    .delete()
    .eq('batch_id', batchRow.id)

  if (deleteClustersError) {
    throw deleteClustersError
  }

  const { error: deleteFacesError } = await supabase
    .from('media_review_faces')
    .delete()
    .eq('batch_id', batchRow.id)

  if (deleteFacesError) {
    throw deleteFacesError
  }

  const clusterRows = clusters.map((cluster) => {
    const review = reviewByClusterId.get(cluster.clusterId)
    const members = cluster.members.map((member) => ({
      ...member,
      thumbnailObjectPath: member.thumbnailPath
        ? `${artifactPrefix}/faces/${member.thumbnailPath}`
        : null,
    }))

    const resolvedReviewStatus =
      review?.reviewStatus === 'confirmed'
        ? 'confirmed'
        : review?.reviewStatus === 'ignored'
          ? 'ignored'
          : review?.mergeIntoClusterId
            ? 'merged'
            : review?.reviewStatus === 'split_requested'
              ? 'split_requested'
              : 'pending'

    return {
      batch_id: batchRow.id,
      cluster_id: cluster.clusterId,
      review_status: resolvedReviewStatus,
      confirmed_name: review?.confirmedName ?? null,
      merge_into_cluster_id: review?.mergeIntoClusterId ?? null,
      split_requested: review?.reviewStatus === 'split_requested',
      split_notes: review?.notes ?? null,
      sample_thumbnail_path: members.find((member) => member.thumbnailObjectPath)?.thumbnailObjectPath ?? null,
      member_count: cluster.memberCount,
      average_quality_score: cluster.averageQualityScore ?? null,
      source_record_ids: [...new Set(members.map((member) => member.sourceRecordId).filter(Boolean))],
      members,
      metadata: {
        localThumbnailPaths: members.map((member) => member.thumbnailPath).filter(Boolean),
      },
      updated_at: new Date().toISOString(),
    }
  })

  if (clusterRows.length > 0) {
    const { error: insertClustersError } = await supabase
      .from('media_review_clusters')
      .insert(clusterRows)

    if (insertClustersError) {
      throw insertClustersError
    }
  }

  const faceRows = detections
    .map((detection) => {
      const manifestRow = importManifestByRecordId.get(detection.sourceRecordId)
      if (!manifestRow) {
        return null
      }

      const cluster = clusterByFaceId.get(detection.faceId) ?? clusterById.get(detection.clusterId)
      const clusterId = cluster?.clusterId ?? detection.clusterId ?? null
      const review = clusterId ? reviewByClusterId.get(clusterId) : null
      const confirmedName = clusterId ? resolvedNames.get(clusterId) : null
      const reviewStatus = resolveClusterStatus(review)

      return {
        batch_id: batchRow.id,
        face_id: detection.faceId,
        cluster_id: clusterId,
        source_record_id: detection.sourceRecordId ?? null,
        source_relative_path: detection.sourceRelativePath ?? manifestRow.sourceRelativePath ?? null,
        photo_url: toSiteMediaPath(manifestRow.photoRowDraft.url),
        thumbnail_url: toSiteMediaPath(manifestRow.photoRowDraft.thumbnail),
        thumbnail_object_path: detection.thumbnailPath
          ? `${artifactPrefix}/faces/${toPosix(detection.thumbnailPath)}`
          : null,
        x: detection.x ?? 0,
        y: detection.y ?? 0,
        box: detection.box ?? {},
        quality_score: detection.qualityScore ?? cluster?.averageQualityScore ?? null,
        review_status: reviewStatus,
        confirmed_name: confirmedName ?? null,
        person_key: confirmedName ? slugify(confirmedName) : null,
        notes: review?.notes?.trim() || null,
        metadata: {
          collection: detection.collection ?? manifestRow.collection ?? null,
          storyLaneSuggestion: detection.storyLaneSuggestion ?? manifestRow.storyLaneSuggestion ?? null,
          suggestedLabel: review?.suggestedLabel ?? null,
          crop: detection.crop ?? null,
          boxScore: detection.boxScore ?? null,
          faceScore: detection.faceScore ?? null,
          captureDate: detection.captureDate ?? manifestRow.captureDate ?? null,
          detectionDimensions: detection.detectionDimensions ?? null,
          coverCandidateRank: manifestRow.coverCandidateRank ?? null,
          duplicateGroupId: manifestRow.duplicateGroupId ?? null,
          similarGroupId: manifestRow.similarGroupId ?? null,
          livePhotoGroupId: manifestRow.livePhotoGroupId ?? null,
        },
      }
    })
    .filter(Boolean)

  if (faceRows.length > 0) {
    const { error: insertFacesError } = await supabase
      .from('media_review_faces')
      .insert(faceRows)

    if (insertFacesError) {
      throw insertFacesError
    }
  }

  const report = {
    batchKey,
    batchId: batchRow.id,
    bucket: BUCKET_NAME,
    artifactPrefix,
    uploadedArtifactCount: uploadTargets.length,
    uploadedArtifacts: uploadTargets.map(([, objectPath]) => objectPath),
    clusterCount: clusters.length,
    detectionCount: detections.length,
    faceRowCount: faceRows.length,
    generatedAt: new Date().toISOString(),
  }

  const reportPath = path.join(publishRoot, 'wedding-photo-review-push-report.json')
  const summaryPath = path.join(publishRoot, 'wedding-photo-review-push-report.md')

  await writeJson(reportPath, report)
  await writeMarkdown(summaryPath, [
    '# Wedding Photo Review Push Report',
    '',
    `Batch key: \`${batchKey}\``,
    `Batch id: \`${batchRow.id}\``,
    `Bucket: \`${BUCKET_NAME}\``,
    '',
    `- Uploaded artifacts: **${uploadTargets.length}**`,
    `- Clusters pushed: **${clusters.length}**`,
    `- Face detections represented: **${detections.length}**`,
    `- Face review rows staged: **${faceRows.length}**`,
    '',
    '## Notes',
    '- Batch review artifacts are stored in a private admin-only bucket.',
    '- Photo-first face review data is now available in the admin review interface.',
  ])

  console.log(`Pushed review batch ${batchKey} to ${BUCKET_NAME}`)
  console.log(`Wrote review push report to ${reportPath}`)
}

await main()
