import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import tus from 'tus-js-client'
import { createClient } from '@supabase/supabase-js'
import {
  assertExists,
  readJson,
  toRemoteMediaObjectPath,
  toSiteMediaPath,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = process.env.SUPABASE_MEDIA_BUCKET || 'wedding-media'

const workingRoot = process.argv[2]
const manifestArg = process.argv[3]
const optimizedRootArg = process.argv[4]

if (!workingRoot) {
  console.error('Usage: node scripts/publish-photo-batch.mjs <working-root> [manifest-json] [optimized-root]')
  process.exit(1)
}

if (!PROJECT_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const CONTENT_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.json', 'application/json'],
  ['.m4a', 'audio/mp4'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.vtt', 'text/vtt'],
  ['.wav', 'audio/wav'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
])

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})
const PHOTO_LOOKUP_CHUNK_SIZE = 40

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
}

function normalizeDateValue(value) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toISOString()
}

async function ensureBucket() {
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(BUCKET_NAME)

  if (!getBucketError && existingBucket) {
    return
  }

  const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
  })

  if (createBucketError) {
    throw createBucketError
  }
}

async function uploadFile(filePath, objectName, contentType) {
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
        contentType,
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

function normalizePhotoDraft(row) {
  return {
    url: toSiteMediaPath(row.photoRowDraft.url),
    thumbnail: toSiteMediaPath(row.photoRowDraft.thumbnail),
    caption: row.photoRowDraft.caption ?? null,
    category: row.photoRowDraft.category ?? row.collection ?? 'Uncategorized',
    location: row.photoRowDraft.location ?? null,
    date: normalizeDateValue(row.photoRowDraft.date),
    photographer: row.photoRowDraft.photographer ?? null,
    is_professional: Boolean(row.photoRowDraft.is_professional),
    tags: row.photoRowDraft.tags ?? [],
    faces: row.photoRowDraft.faces ?? [],
  }
}

function normalizeExistingPhoto(row) {
  return {
    url: row.url,
    thumbnail: row.thumbnail,
    caption: row.caption ?? null,
    category: row.category ?? null,
    location: row.location ?? null,
    date: normalizeDateValue(row.date),
    photographer: row.photographer ?? null,
    is_professional: Boolean(row.is_professional),
    tags: row.tags ?? [],
    faces: row.faces ?? [],
  }
}

function rowsMatch(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function fetchExistingPhotos(urls) {
  const existing = []

  for (const urlChunk of chunk(urls, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .in('url', urlChunk)

    if (error) {
      throw error
    }

    existing.push(...(data || []))
  }

  return new Map(existing.map((row) => [row.url, row]))
}

async function syncPhotoRows(rows) {
  const existingByUrl = await fetchExistingPhotos(rows.map((row) => toSiteMediaPath(row.photoRowDraft.url)))
  const inserts = []
  const updates = []
  const skipped = []

  for (const row of rows) {
    const normalizedDraft = normalizePhotoDraft(row)
    const existing = existingByUrl.get(normalizedDraft.url)

    if (!existing) {
      inserts.push({
        ...normalizedDraft,
        likes: 0,
      })
      continue
    }

    const comparableExisting = normalizeExistingPhoto(existing)
    if (rowsMatch(normalizedDraft, comparableExisting)) {
      skipped.push({
        url: normalizedDraft.url,
        reason: 'already-matches',
      })
      continue
    }

    updates.push({
      id: existing.id,
      ...normalizedDraft,
      likes: existing.likes ?? 0,
      caption: normalizedDraft.caption ?? existing.caption ?? null,
    })
  }

  let insertedCount = 0
  let updatedCount = 0

  if (inserts.length > 0) {
    const { error } = await supabase
      .from('photos')
      .insert(inserts)

    if (error) {
      throw error
    }

    insertedCount = inserts.length
  }

  if (updates.length > 0) {
    const { error } = await supabase
      .from('photos')
      .upsert(updates, { onConflict: 'id' })

    if (error) {
      throw error
    }

    updatedCount = updates.length
  }

  return {
    insertedCount,
    updatedCount,
    skipped,
  }
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')
  const manifestPath = manifestArg
    ? path.resolve(manifestArg)
    : path.join(publishRoot, 'wedding-photo-import-manifest.json')
  const optimizedRoot = optimizedRootArg
    ? path.resolve(optimizedRootArg)
    : path.join(absoluteWorkingRoot, 'optimized')
  const optimizedManifestPath = path.join(optimizedRoot, 'optimized-manifest.json')

  await assertExists(manifestPath, 'publish manifest')
  await assertExists(optimizedManifestPath, 'optimized manifest')

  const manifestRows = await readJson(manifestPath)
  const optimizedManifest = await readJson(optimizedManifestPath)

  await ensureBucket()

  const uploadTargets = optimizedManifest.flatMap((item) => {
    if (item.type === 'image') {
      return [
        {
          localPath: path.join(optimizedRoot, item.displayRelativePath),
          relativePath: item.displayRelativePath,
        },
        {
          localPath: path.join(optimizedRoot, item.thumbRelativePath),
          relativePath: item.thumbRelativePath,
        },
      ]
    }

    return [
      {
        localPath: path.join(optimizedRoot, item.outputRelativePath),
        relativePath: item.outputRelativePath,
      },
    ]
  })

  const uploadResults = []

  for (const target of uploadTargets) {
    const objectName = toRemoteMediaObjectPath(target.relativePath)
    await uploadFile(target.localPath, objectName, getContentType(target.localPath))
    uploadResults.push({
      localPath: target.localPath,
      relativePath: target.relativePath,
      objectName,
    })
  }

  const skippedRows = []
  const publishableRows = manifestRows.filter((row) => {
    if (row.collection === 'Engagement') {
      skippedRows.push({
        sourceRelativePath: row.sourceRelativePath,
        reason: 'engagement-editorial-overlay',
      })
      return false
    }

    return true
  })

  const syncResults = await syncPhotoRows(publishableRows)

  const report = {
    workingRoot: absoluteWorkingRoot,
    bucket: BUCKET_NAME,
    uploadedFileCount: uploadResults.length,
    uploadedFiles: uploadResults,
    totalManifestRows: manifestRows.length,
    publishableRowCount: publishableRows.length,
    insertedPhotoRows: syncResults.insertedCount,
    updatedPhotoRows: syncResults.updatedCount,
    unchangedPhotoRows: syncResults.skipped.length,
    skippedRows,
    unchangedRows: syncResults.skipped,
    generatedAt: new Date().toISOString(),
  }

  const reportPath = path.join(publishRoot, 'wedding-photo-publish-report.json')
  const summaryPath = path.join(publishRoot, 'wedding-photo-publish-report.md')

  await writeJson(reportPath, report)
  await writeMarkdown(summaryPath, [
    '# Wedding Photo Publish Report',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    `Bucket: \`${BUCKET_NAME}\``,
    '',
    `- Uploaded files: **${uploadResults.length}**`,
    `- Manifest rows: **${manifestRows.length}**`,
    `- Publishable rows: **${publishableRows.length}**`,
    `- Inserted photo rows: **${syncResults.insertedCount}**`,
    `- Updated photo rows: **${syncResults.updatedCount}**`,
    `- Unchanged photo rows: **${syncResults.skipped.length}**`,
    `- Engagement rows skipped: **${skippedRows.length}**`,
    '',
    '## Notes',
    '- Uploaded media is stored under deterministic `media/...` object keys in the remote bucket.',
    '- Photo rows are stored with relative `/media/...` URLs so the runtime continues to resolve them through `VITE_MEDIA_BASE_URL`.',
    '- Engagement rows are skipped intentionally because the hardcoded engagement gallery remains the editorial overlay.',
  ])

  console.log(`Uploaded ${uploadResults.length} optimized files to ${BUCKET_NAME}`)
  console.log(`Synced ${syncResults.insertedCount + syncResults.updatedCount} photo rows`)
  console.log(`Wrote publish report to ${reportPath}`)
}

await main()
