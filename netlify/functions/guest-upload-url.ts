import type { Handler } from '@netlify/functions'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'node:crypto'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

// Client-side validates 500 MB max; server enforces the same.
const MAX_SIZE_BYTES = 500 * 1024 * 1024

// Module scope — constructed once and reused across warm invocations.
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_MEDIA_BUCKET || 'wedding-media'
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL

  if (!accountId || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return { statusCode: 500, body: 'Server configuration error' }
  }

  let body: { contentType: string; contentLength: number }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { contentType, contentLength } = body

  if (!ALLOWED_TYPES.has(contentType)) {
    return { statusCode: 400, body: 'Unsupported file type' }
  }

  if (typeof contentLength !== 'number' || contentLength <= 0 || contentLength > MAX_SIZE_BYTES) {
    return { statusCode: 400, body: 'Invalid content length' }
  }

  const mediaType = contentType.startsWith('video/') ? 'videos' : 'photos'
  const ext = contentType.split('/')[1].replace('quicktime', 'mov').replace('jpeg', 'jpg')
  const objectKey = `guest-uploads/${mediaType}/${crypto.randomUUID()}.${ext}`

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: contentLength,
  })

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
    const publicUrl = `${publicBaseUrl}/${objectKey}`

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadUrl, publicUrl }),
    }
  } catch {
    return { statusCode: 500, body: 'Failed to generate upload URL' }
  }
}
