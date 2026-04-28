import fs from 'node:fs'
import path from 'node:path'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_MEDIA_BUCKET || 'wedding-media'

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials')
  process.exit(1)
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
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
])

function walk(directory, extensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4']) {
  const results = []
  if (!fs.existsSync(directory)) return results

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, extensions))
    } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath)
    }
  }
  return results
}

async function uploadFile(filePath, objectName) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = CONTENT_TYPES.get(ext) || 'application/octet-stream'
  const fileSize = fs.statSync(filePath).size

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

  await upload.done()
  console.log(`Uploaded ${objectName}`)
}

async function main() {
  const sourceFolders = [
    {
      source: 'C:/Users/bbask/Pictures/Wedding Master/Bachelor+ette',
      prefix: 'media/Bach+ette/Photos',
    },
    {
      source: 'C:/Users/bbask/Pictures/Wedding Master/Guest-Shared Wedding Gallery',
      prefix: 'media/Guest Uploads/Wedding Day/Live Photos/Stills',
    },
    {
      source: 'C:/Users/bbask/Pictures/Wedding Master/Professional Wedding',
      prefix: 'media/Professional/Wedding Day/Photos',
    },
  ]

  for (const { source, prefix } of sourceFolders) {
    console.log(`\nScanning ${source}...`)
    const files = walk(source)

    if (files.length === 0) {
      console.log(`No files found in ${source}`)
      continue
    }

    console.log(`Found ${files.length} files to upload`)

    for (const filePath of files) {
      const filename = path.basename(filePath)
      const objectName = `${prefix}/${filename}`
      try {
        await uploadFile(filePath, objectName)
      } catch (e) {
        console.error(`Failed to upload ${filePath}: ${e.message}`)
      }
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
