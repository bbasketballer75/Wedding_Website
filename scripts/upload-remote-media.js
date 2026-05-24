import fs from 'node:fs'
import path from 'node:path'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import dotenv from 'dotenv'

// Load environment configurations
dotenv.config()

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_MEDIA_BUCKET || 'wedding-media'
const R2_PUBLIC_BASE_URL =
  process.env.R2_PUBLIC_BASE_URL ||
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_MEDIA_BUCKET || 'wedding-media'}`
const MEDIA_ROOTS = ['public/video', 'public/background_audio', 'public/media']

if (!R2_ACCOUNT_ID) {
  throw new Error('Missing R2_ACCOUNT_ID')
}

if (!R2_ACCESS_KEY_ID) {
  throw new Error('Missing R2_ACCESS_KEY_ID')
}

if (!R2_SECRET_ACCESS_KEY) {
  throw new Error('Missing R2_SECRET_ACCESS_KEY')
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
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

  return normalizedPath.split(/[\\/]/).filter(Boolean).map(sanitizePathSegment).join('/')
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

async function uploadFile(filePath, objectName, contentType) {
  const fileSize = fs.statSync(filePath).size
  const fileSizeMb = (fileSize / (1024 * 1024)).toFixed(2)
  let lastLoggedPercent = -1

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET_NAME,
      Key: objectName,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    },
    partSize: 6 * 1024 * 1024,
    queueSize: 4,
  })

  upload.on('httpUploadProgress', progress => {
    const loaded = progress.loaded ?? 0
    const total = progress.total ?? fileSize

    if (total > 0) {
      const percent = Math.floor((loaded / total) * 100)

      if (percent >= lastLoggedPercent + 25 || percent === 100) {
        lastLoggedPercent = percent
        console.log(`Progress ${objectName}: ${percent}%`)
      }
    }
  })

  await upload.done()
  console.log(`Uploaded ${objectName} (${fileSizeMb} MB)`)
}

// Fetch all existing objects in R2 bucket
async function fetchExistingR2Objects() {
  console.log('Fetching list of existing objects in R2 bucket...')
  const existingMap = new Map()
  let continuationToken = undefined
  let isTruncated = true

  try {
    while (isTruncated) {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          ContinuationToken: continuationToken,
        })
      )

      if (response.Contents) {
        for (const item of response.Contents) {
          existingMap.set(item.Key, item.Size)
        }
      }

      isTruncated = response.IsTruncated
      continuationToken = response.NextContinuationToken
    }
    console.log(`Successfully mapped ${existingMap.size} remote objects from R2.`)
  } catch (error) {
    console.error('Failed to list existing R2 objects:', error)
  }

  return existingMap
}

async function main() {
  const localFiles = MEDIA_ROOTS.filter(root => fs.existsSync(root)).flatMap(root => walk(root))
  console.log(`Found ${localFiles.length} local media files.`)

  const remoteObjects = await fetchExistingR2Objects()

  const filesToUpload = []

  for (const filePath of localFiles) {
    const objectName = toRemoteMediaPath(filePath)
    const localSize = fs.statSync(filePath).size
    const remoteSize = remoteObjects.get(objectName)

    if (remoteSize === undefined) {
      console.log(`[NEW] ${objectName} is not in R2 bucket yet.`)
      filesToUpload.push({ filePath, objectName })
    } else if (localSize !== remoteSize) {
      const localSizeMb = (localSize / (1024 * 1024)).toFixed(2)
      const remoteSizeMb = (remoteSize / (1024 * 1024)).toFixed(2)
      console.log(
        `[MODIFIED] ${objectName} size mismatch (Local: ${localSizeMb} MB vs R2: ${remoteSizeMb} MB).`
      )
      filesToUpload.push({ filePath, objectName })
    } else {
      // Exists and size is identical: Skip!
    }
  }

  if (filesToUpload.length === 0) {
    console.log('All local files are already fully synced and up-to-date in R2. Nothing to upload!')
    return
  }

  console.log(`Starting bulk upload for ${filesToUpload.length} files...`)

  for (const { filePath, objectName } of filesToUpload) {
    const contentType = getContentType(filePath)
    await uploadFile(filePath, objectName, contentType)
  }

  console.log(`Done. All files synced. Live files available at: ${R2_PUBLIC_BASE_URL}`)
}

main().catch(error => {
  console.error('Remote media upload failed:', error)
  process.exitCode = 1
})
