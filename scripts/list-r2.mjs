import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config()

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_MEDIA_BUCKET || 'wedding-media'

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing credentials in .env file')
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

async function main() {
  console.log(`Checking bucket: ${BUCKET_NAME}...`)
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    })
  )
  
  if (response.Contents && response.Contents.length > 0) {
    console.log(`Found ${response.Contents.length} objects:`)
    for (const item of response.Contents) {
      console.log(` - ${item.Key} (${(item.Size / (1024 * 1024)).toFixed(2)} MB)`)
    }
  } else {
    console.log('Bucket is currently empty.')
  }
}

main().catch(console.error)
