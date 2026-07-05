/**
 * Batch import photos from R2 into the Supabase photos table.
 * Also uploads local engagement photos to R2 and registers them.
 */
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import fs from 'node:fs'
import path from 'node:path'

// Config
const SUPABASE_URL = 'https://zaczcyzvavetgfuucljf.supabase.co'
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphY3pjeXp2YXZldGdmdXVjbGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzgzMDMsImV4cCI6MjA5MjkxNDMwM30.fcqeXGrkDtrsj6Vw58RVuv-Az5fi38ZXRIGTmSN6Nqc'
const R2_ACCOUNT_ID = 'eeb5d94194e46f57e8c91d48edf9719a'
const R2_ACCESS_KEY_ID = 'fa9bb76945943d79b604ad5f2231a15a'
const R2_SECRET_ACCESS_KEY = '4c7f51c2a8cf8ecf61c8e915b44dbb44e729b39a851174bd0f01a927dc1c3bbe'
const BUCKET = 'wedding-media'
const R2_BASE = 'https://media.wedding.theporadas.com'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
}

async function uploadToR2(filePath, objectName) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: objectName,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    },
    partSize: 6 * 1024 * 1024,
    queueSize: 4,
  })
  await upload.done()
}

async function listR2(prefix) {
  const objects = []
  let ContinuationToken
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken,
      MaxKeys: 1000,
    })
    const r = await s3.send(cmd)
    objects.push(...(r.Contents || []).map(o => o.Key))
    ContinuationToken = r.NextContinuationToken
  } while (ContinuationToken)
  return objects
}

async function batchInsert(records, batchSize = 50) {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from('photos').insert(batch)
    if (error) {
      console.error(`Insert error at ${i}:`, error.message)
    } else {
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`)
    }
  }
}

const ALBUM_MAP = {
  'media/Bach+ette/Photos/': {
    album: 'Bach+ette',
    category: 'Bach+ette',
    photographer: 'Professional',
    is_professional: true,
  },
  'media/Professional/': {
    album: 'Wedding Day',
    category: 'Wedding Day',
    photographer: 'Professional',
    is_professional: true,
  },
  'media/Guest Uploads/': {
    album: 'Guest Uploads',
    category: 'Guest Uploads',
    photographer: 'Guest',
    is_professional: false,
  },
  'media/Engagement/Photos/': {
    album: 'Engagement',
    category: 'Engagement',
    photographer: 'Professional',
    is_professional: true,
  },
}

async function importFromR2() {
  console.log('Fetching file list from R2...')
  const allKeys = await listR2('media/')
  const photoKeys = allKeys.filter(k => {
    const ext = path.extname(k).toLowerCase()
    return ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext) && !k.endsWith('/')
  })
  console.log(`Found ${photoKeys.length} photos in R2`)

  // Determine album for each photo
  let sortOrder = 1
  const records = photoKeys.map(key => {
    let albumMeta = {
      album: 'Wedding Day',
      category: 'Wedding Day',
      photographer: 'Unknown',
      is_professional: false,
    }
    for (const [prefix, meta] of Object.entries(ALBUM_MAP)) {
      if (key.startsWith(prefix)) {
        albumMeta = meta
        break
      }
    }
    const url = key // stored as relative R2 path
    const thumbnail = key
    return {
      url,
      thumbnail,
      album: albumMeta.album,
      album_sort_order: sortOrder++,
      category: albumMeta.category,
      photographer: albumMeta.photographer,
      is_professional: albumMeta.is_professional,
      tags: [albumMeta.album.toLowerCase()],
      likes: 0,
      faces: [],
    }
  })

  console.log(`\nInserting ${records.length} photo records...`)
  await batchInsert(records)
  console.log('Done importing from R2!')
}

// Upload local engagement photos to R2 and return their paths
const ENGAGEMENT_PHOTOS = [
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-4.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-6.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-11.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-28.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-29.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-31.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-36.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-40.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-58.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-62.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-67.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-75.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-78.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-146.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-150.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-156.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-181.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-198.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-255.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-259.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-262.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-268.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-273.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-277.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-286.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-309.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-310.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-316.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-318.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-320.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-359.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-375.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-421.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-458.webp',
  'E:/PC_BKUP/BACKUP/FINAL WEDDING MEDIA/engagemnet/PoradaProposal-482.webp',
]

async function uploadEngagementPhotos() {
  console.log(`\nUploading ${ENGAGEMENT_PHOTOS.length} engagement photos to R2...`)
  const records = []
  let sortOrder = 1

  for (const filePath of ENGAGEMENT_PHOTOS) {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`)
      continue
    }
    const filename = path.basename(filePath)
    const objectName = `media/Engagement/Photos/${filename}`
    try {
      await uploadToR2(filePath, objectName)
      console.log(`Uploaded: ${objectName}`)
      records.push({
        url: objectName,
        thumbnail: objectName,
        album: 'Engagement',
        album_sort_order: sortOrder++,
        category: 'Engagement',
        photographer: 'Professional',
        is_professional: true,
        tags: ['engagement', 'proposal'],
        likes: 0,
        faces: [],
      })
    } catch (e) {
      console.error(`Failed to upload ${filePath}: ${e.message}`)
    }
  }

  if (records.length > 0) {
    console.log(`\nInserting ${records.length} engagement photo records...`)
    await batchInsert(records)
  }
  console.log('Done with engagement photos!')
}

async function main() {
  await importFromR2()
  await uploadEngagementPhotos()
  console.log('\n=== ALL DONE ===')
  console.log('Refresh the gallery page to see the photos.')
}

main().catch(console.error)
