import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import tus from 'tus-js-client'

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = process.env.SUPABASE_MEDIA_BUCKET || 'wedding-media'
const MEDIA_ROOTS = ['public/video', 'public/background_audio', 'public/media']

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

const CONTENT_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.flac', 'audio/flac'],
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

function hashString(value) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function sanitizePathSegment(segment) {
  const lastDotIndex = segment.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0
  const baseName = hasExtension ? segment.slice(0, lastDotIndex) : segment
  const extension = hasExtension ? segment.slice(lastDotIndex) : ''
  const safeBaseName = baseName.replace(/[^A-Za-z0-9._-]/g, '_')

  if (safeBaseName === baseName) {
    return `${safeBaseName}${extension}`
  }

  return `${safeBaseName}__${hashString(segment)}${extension}`
}

function toRemoteMediaPath(filePath) {
  const normalizedPath = filePath.replace(/^public[\\/]/, '')

  return normalizedPath
    .split(/[\\/]/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/')
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
}

function walk(directory) {
  const results = []

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      results.push(...walk(fullPath))
      continue
    }

    results.push(fullPath)
  }

  return results
}

async function ensureBucket() {
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(BUCKET_NAME)

  if (!getBucketError && existingBucket) {
    console.log(`Using existing bucket ${BUCKET_NAME}`)
    return
  }

  const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
  })

  if (createBucketError) {
    throw createBucketError
  }

  console.log(`Created bucket ${BUCKET_NAME}`)
}

async function uploadFile(filePath, objectName, contentType) {
  const fileSize = fs.statSync(filePath).size
  const fileSizeMb = (fileSize / (1024 * 1024)).toFixed(2)

  await new Promise((resolve, reject) => {
    let lastLoggedPercent = -1

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
      onProgress(bytesUploaded, bytesTotal) {
        const percent = Math.floor((bytesUploaded / bytesTotal) * 100)

        if (percent >= lastLoggedPercent + 25 || percent === 100) {
          lastLoggedPercent = percent
          console.log(`Progress ${objectName}: ${percent}%`)
        }
      },
      onSuccess() {
        console.log(`Uploaded ${objectName} (${fileSizeMb} MB)`)
        resolve()
      },
    })

    upload.start()
  })
}

async function main() {
  await ensureBucket()

  const files = MEDIA_ROOTS.flatMap(root => walk(root))
  console.log(`Uploading ${files.length} files to ${BUCKET_NAME}`)

  for (const filePath of files) {
    const objectName = toRemoteMediaPath(filePath)
    const contentType = getContentType(filePath)
    await uploadFile(filePath, objectName, contentType)
  }

  console.log(`${PROJECT_URL}/storage/v1/object/public/${BUCKET_NAME}`)
}

main().catch(error => {
  console.error('Remote media upload failed:', error)
  process.exitCode = 1
})
